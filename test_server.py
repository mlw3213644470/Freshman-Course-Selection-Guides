"""Offline tests. Any accidental real HTTP transport is blocked."""
import io
import asyncio
import json
import unittest
import zipfile
import tempfile
import shutil
from pathlib import Path
from unittest.mock import patch

import httpx
from pypdf import PdfWriter

import server


def pdf_bytes(encrypted=False):
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    if encrypted:
        writer.encrypt("test-password")
    stream = io.BytesIO()
    writer.write(stream)
    return stream.getvalue()


def empty_result():
    return {key: [{"text": "原文未说明", "source": None}] for key in server.RESULT_KEYS}


def result_response():
    return {"status": "completed", "output": [{"type": "message", "content": [
        {"type": "output_text", "text": json.dumps(empty_result())}
    ]}]}


def sse_frame(kind, **fields):
    return ("event: " + kind + "\r\ndata: " + json.dumps({"type": kind, **fields}) + "\r\n\r\n").encode()


class MockSSE(httpx.AsyncByteStream):
    def __init__(self, chunks):
        self.chunks = chunks

    async def __aiter__(self):
        for chunk in self.chunks:
            if isinstance(chunk, Exception):
                raise chunk
            yield chunk


def sse_response(chunks=None):
    if chunks is None:
        text = json.dumps(empty_result(), ensure_ascii=False)
        data = (b": heartbeat\r\n\r\n" + sse_frame("response.created") +
                sse_frame("response.output_text.delta", delta=text[:20]) +
                sse_frame("response.output_text.delta", delta=text[20:]) +
                sse_frame("response.completed", response=result_response()))
        chunks = [data[index:index+7] for index in range(0, len(data), 7)]
    return httpx.Response(200, headers={"content-type": "text/event-stream"}, stream=MockSSE(chunks))


class OfflineTests(unittest.TestCase):
    def setUp(self):
        guard = patch.object(httpx.HTTPTransport, "handle_request", side_effect=AssertionError("Real HTTP forbidden"))
        guard.start()
        self.addCleanup(guard.stop)
        async_guard = patch.object(httpx.AsyncHTTPTransport, "handle_async_request", side_effect=AssertionError("Real HTTP forbidden"))
        async_guard.start()
        self.addCleanup(async_guard.stop)
        self.app = server.create_app({"TESTING": True, "DEEPSEEK_API_KEY": "offline-test"})
        self.client = self.app.test_client()

    def post(self, data=None, filename="plan.pdf", **kwargs):
        return self.client.post("/api/training-plan/analyze", data={
            "file": (io.BytesIO(pdf_bytes() if data is None else data), filename)
        }, **kwargs)

    def test_static_and_secrets(self):
        with self.client.get("/") as response:
            self.assertEqual(response.status_code, 200)
            self.assertIn("新生选课指南", response.text)
        # Built pages are served from dist/ by the same backend.
        with self.client.get("/guide.html") as response:
            self.assertEqual(response.status_code, 200)
        for path in ("/pages/training-plan.html", "/global.css", "/assets/campus-background.png",
                     "/Freshman-Course-Selection-Guides/pages/training-plan.html",
                     "/Freshman-Course-Selection-Guides/global.css"):
            with self.client.get(path) as response:
                self.assertEqual(response.status_code, 200)
        for path in ("/.env", "/Freshman-Course-Selection-Guides/.env", "/Freshman-Course-Selection-Guides/.git/config",
                     "/Freshman-Course-Selection-Guides/server.py", "/Freshman-Course-Selection-Guides/../.env",
                     "/网页.html", "/首页.css", "/ABFFFC33CA805A3D44D73FFB6AD9E783.png"):
            self.assertEqual(self.client.get(path).status_code, 404)

    def test_standalone_checkout_without_parent_homepage(self):
        # A differently named checkout with no parent HTML/CSS/image files.
        with tempfile.TemporaryDirectory() as temporary:
            checkout = Path(temporary) / "teammate-checkout"
            for filename in ("pages/training-plan.html", "pages/training-plan.css", "pages/training-plan.js",
                             "global.css", "assets/campus-background.png"):
                destination = checkout / filename
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(server.ROOT / filename, destination)
            with patch.object(server, "ROOT", checkout):
                with self.client.get("/", follow_redirects=True) as response:
                    self.assertEqual(response.status_code, 200)
                    self.assertIn("培养方案", response.text)
                    self.assertNotIn("../../网页.html", response.text)
                for url in ("/pages/training-plan.css", "/pages/training-plan.js", "/global.css", "/assets/campus-background.png"):
                    with self.client.get(url) as response:
                        self.assertEqual(response.status_code, 200)

    def test_config_missing(self):
        self.app.config["DEEPSEEK_API_KEY"] = ""
        self.assertEqual(self.post().status_code, 503)

    def test_reject_cross_origin(self):
        self.assertEqual(self.post(headers={"Origin": "https://other.example"}).status_code, 403)

    def test_reverse_proxy_public_host_origin(self):
        # The proxy replaces Host with an internal name, but the browser keeps
        # the public origin. An explicitly configured host must be accepted.
        with patch.object(server, "PUBLIC_APP_HOST", "guide.example"):
            response = self.post(data=b"fake", filename="fake.pdf",
                                 headers={"Origin": "https://guide.example"})
        self.assertEqual(response.status_code, 400)

    def test_sharecode_is_kept_on_internal_links(self):
        with self.client.get("/?sharecode=abc123") as response:
            self.assertEqual(response.status_code, 200)
            self.assertIn("URLSearchParams(location.search)", response.text)
            self.assertIn("querySelectorAll", response.text)
        with self.client.get("/?sharecode=%3Cscript%3Ealert(1)%3C%2Fscript%3E") as response:
            self.assertNotIn("alert(1)", response.text)

    def test_invalid_files(self):
        for data, name in ((b"word", "plan.docx"), (b"fake", "fake.pdf"), (b"%PDF-1.7\nbroken", "broken.pdf"),
                           (b"", "empty.pdf"), (pdf_bytes(True), "locked.pdf")):
            with self.subTest(name=name):
                self.assertEqual(self.post(data, name).status_code, 400)

    def test_oversize(self):
        with patch.object(server, "MAX_PDF_BYTES", 100):
            self.assertEqual(self.post().status_code, 413)
        self.app.config["MAX_CONTENT_LENGTH"] = 100
        self.assertEqual(self.post().status_code, 413)

    def test_missing_and_multiple(self):
        self.assertEqual(self.client.post("/api/training-plan/analyze").status_code, 400)
        response = self.client.post("/api/training-plan/analyze", data={"file": [
            (io.BytesIO(pdf_bytes()), "one.pdf"), (io.BytesIO(pdf_bytes()), "two.pdf")
        ]})
        self.assertEqual(response.status_code, 400)

    def test_route_result_and_errors(self):
        with patch.object(server, "analyze_document", return_value=empty_result()) as analyze:
            response = self.post()
            self.assertEqual(response.status_code, 200)
            self.assertEqual(len(response.json["result"]), 5)
            self.assertEqual(response.headers["Cache-Control"], "no-store")
            analyze.assert_called_once()
        with patch.object(server, "analyze_document", side_effect=httpx.ReadTimeout("secret")):
            response = self.post()
            self.assertEqual(response.status_code, 504)
            self.assertNotIn("secret", response.text)
        # Lock must be released after failure.
        with patch.object(server, "analyze_document", return_value={}) as analyze:
            self.post()
            analyze.assert_called_once()

    def test_docx_validation_and_route(self):
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, "w") as archive:
            archive.writestr("[Content_Types].xml", '<Types><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
            archive.writestr("word/document.xml", '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>')
        with patch.object(server, "analyze_document", return_value=empty_result()) as analyze:
            self.assertEqual(self.post(stream.getvalue(), "plan.docx").status_code, 200)
            self.assertEqual(analyze.call_args.args[2], "training-plan.docx")
        self.assertEqual(self.post(b"PK fake archive", "fake.docx").status_code, 400)

    def test_upload_order_responses_and_cleanup(self):
        calls = []
        def handler(request):
            calls.append((request.method, request.url.path))
            self.assertEqual(request.url.host, "api.deepseek.com")
            if request.method == "DELETE":
                self.assertEqual(request.url.path, "/files/file-test")
                return httpx.Response(200, json={"deleted": True})
            if request.url.path == "/responses":
                payload = json.loads(request.content)
                self.assertEqual(payload["model"], "deepseek-flash")
                self.assertTrue(payload["stream"])
                self.assertIn("原文未说明", payload["instructions"])
                self.assertEqual(payload["input"][0]["content"][0], {"type": "input_file", "file_id": "file-test"})
                return sse_response()
            self.assertEqual(request.url.path, "/files")
            self.assertLess(request.content.index(b'name="purpose"'), request.content.index(b'name="file"'))
            self.assertIn(b"text_recognition", request.content)
            return httpx.Response(200, json={"id": "file-test"})  # No status field in DeepSeek response.
        result = server.analyze_document(pdf_bytes(), "offline", "plan.pdf", "application/pdf", transport=httpx.MockTransport(handler))
        self.assertEqual(len(result), 5)
        self.assertEqual(calls, [("POST", "/files"), ("POST", "/responses"), ("DELETE", "/files/file-test")])

    def test_http_errors_log_stage_and_redact(self):
        for failed_path, step in (("/files", "Files 上传"), ("/responses", "Responses 模型分析")):
            calls = []
            def handler(request):
                calls.append(request.method)
                if request.method != "DELETE" and request.url.path == failed_path:
                    return httpx.Response(400, json={"error": {
                        "code": "invalid_request", "message": "invalid offline-secret\nBearer other-secret " + "x"*500
                    }, "document": "PRIVATE_PDF_BODY"})
                return httpx.Response(200, json={"id": "file-test", "deleted": True})
            with self.subTest(step=step), self.assertLogs("server", level="ERROR") as logs, self.assertRaises(server.AnalysisError) as caught:
                server.analyze_document(pdf_bytes(), "offline-secret", "plan.pdf", "application/pdf", transport=httpx.MockTransport(handler))
            message = "\n".join(logs.output)
            self.assertIn(step, message)
            self.assertIn("HTTP=400", message)
            self.assertIn("invalid_request", message)
            for private in ("offline-secret", "other-secret", "PRIVATE_PDF_BODY"):
                self.assertNotIn(private, message)
                self.assertNotIn(private, caught.exception.message)
            self.assertLess(len(message), 450)
            self.assertEqual(calls.count("POST"), 1 if failed_path == "/files" else 2)  # No automatic retries.
            if failed_path == "/responses":
                self.assertEqual(calls[-1], "DELETE")

    def test_network_errors_log_stage(self):
        for path, step in (("/files", "Files 上传"), ("/responses", "Responses 模型分析")):
            def handler(request):
                if request.method != "DELETE" and request.url.path == path:
                    raise httpx.ReadTimeout("private request")
                return httpx.Response(200, json={"id": "file-test"})
            error_type = httpx.ReadTimeout if path == "/files" else server.AnalysisError
            with self.subTest(path=path), self.assertLogs("server", level="ERROR") as logs, self.assertRaises(error_type):
                server.analyze_document(pdf_bytes(), "offline", "plan.pdf", "application/pdf", transport=httpx.MockTransport(handler))
            self.assertIn(step, logs.output[0])
            self.assertNotIn("private request", "\n".join(logs.output))

    def test_auth_failure_safe(self):
        transport = httpx.MockTransport(lambda _r: httpx.Response(401, json={"error": {"message": "private"}}))
        with self.assertLogs("server", level="ERROR"), self.assertRaises(server.AnalysisError) as caught:
            server.analyze_document(pdf_bytes(), "offline", "plan.pdf", "application/pdf", transport=transport)
        self.assertNotIn("private", caught.exception.message)

    def test_invalid_model_result_still_cleans_up(self):
        calls = []
        def handler(request):
            calls.append(request.method)
            return httpx.Response(200, json={"id": "file-test"} if request.url.path == "/files" else {"status": "incomplete"})
        with self.assertRaises(server.AnalysisError):
            server.analyze_document(pdf_bytes(), "offline", "plan.pdf", "application/pdf", transport=httpx.MockTransport(handler))
        self.assertEqual(calls, ["POST", "POST", "DELETE"])

    def test_cleanup_failure_preserves_success(self):
        def handler(request):
            if request.method == "DELETE":
                return httpx.Response(500, json={"error": {"code": "internal_error", "message": "Please retry"}})
            return sse_response() if request.url.path == "/responses" else httpx.Response(200, json={"id": "file-test"})
        with self.assertLogs("server", level="ERROR") as logs:
            result = server.analyze_document(pdf_bytes(), "offline", "plan.pdf", "application/pdf", transport=httpx.MockTransport(handler))
        self.assertEqual(len(result), 5)
        self.assertIn("临时文件清理", logs.output[0])

    def test_bad_or_incomplete_results(self):
        for response in ({}, {"status": "incomplete"}, {"status": "completed", "output": []},
                         {"status": "completed", "output": [{"type": "message", "content": [{"type": "output_text", "text": "{}"}]}]}):
            with self.subTest(response=response), self.assertRaises(server.AnalysisError):
                server.parse_result(response)

    def test_structured_results_preserve_credits_and_sources(self):
        result = empty_result()
        result["培养目标"] = [{"text": "目标概括一", "source": None}, {"text": "目标概括二", "source": None}]
        result["学分要求"] = [
            {"text": "总学分不少于 160 学分（适用于 2025 级）", "source": "第 5 页"},
            {"text": "限选课程 6～8 学分，且须完成模块 A；不计入通识学分", "source": "学分要求一节"},
        ]
        result["毕业要求"] = [{"text": "须完成毕业设计", "source": "毕业要求一节"}]
        response = result_response()
        response["output"][0]["content"][0]["text"] = json.dumps(result)
        self.assertEqual(server.parse_result(response), result)

    def test_reject_legacy_or_invalid_structured_results(self):
        invalid_values = ("旧版大段文字", [], [{"text": "", "source": None}],
                          [{"text": "结论"}], [{"text": "结论", "source": 5}],
                          [{"text": "结论\n另一项", "source": None}],
                          [{"text": "原文未说明", "source": "第 5 页"}])
        for value in invalid_values:
            result = empty_result()
            result["毕业要求"] = value
            response = result_response()
            response["output"][0]["content"][0]["text"] = json.dumps(result)
            with self.subTest(value=value), self.assertRaises(server.AnalysisError):
                server.parse_result(response)
        for count in (1, 4):
            result = empty_result()
            result["培养目标"] = [{"text": "概括", "source": None}] * count
            response = result_response()
            response["output"][0]["content"][0]["text"] = json.dumps(result)
            with self.subTest(count=count), self.assertRaises(server.AnalysisError):
                server.parse_result(response)

    def test_non_json_error_does_not_log_raw_body(self):
        response = httpx.Response(502, text="private raw body", request=httpx.Request("POST", "https://example.invalid"))
        with self.assertLogs("server", level="ERROR") as logs, self.assertRaises(server.AnalysisError):
            server.deepseek_json(response, "Files 上传")
        self.assertIn("HTTP=502", logs.output[0])
        self.assertNotIn("private raw body", logs.output[0])

    def test_health_and_no_cache(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.json["provider"], "deepseek")
        self.assertTrue(response.json["configured"])
        self.assertNotIn("offline-test", response.text)
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        self.app.config["DEEPSEEK_API_KEY"] = ""
        self.assertFalse(self.client.get("/api/health").json["configured"])
        with self.client.get("/Freshman-Course-Selection-Guides/pages/training-plan.js?v=deepseek-1") as response:
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers["Cache-Control"], "no-store")

    def stream_transport(self, response):
        calls = []
        def handler(request):
            calls.append((request.method, request.url.path))
            if request.url.path == "/responses":
                self.assertTrue(json.loads(request.content)["stream"])
                self.assertEqual(request.extensions["timeout"]["read"], 120)
                return response
            return httpx.Response(200, json={"id": "file-test", "deleted": True})
        return httpx.MockTransport(handler), calls

    def test_sse_terminal_failures_discard_complete_looking_text(self):
        full_text = json.dumps(empty_result())
        for kind in ("response.incomplete", "response.failed", "error"):
            chunks = [sse_frame("response.output_text.delta", delta=full_text), sse_frame(kind)]
            transport, calls = self.stream_transport(sse_response(chunks))
            with self.subTest(kind=kind), self.assertLogs("server", level="ERROR"), self.assertRaises(server.AnalysisError):
                server.analyze_document(pdf_bytes(), "offline", "plan.pdf", "application/pdf", transport=transport)
            self.assertEqual(calls, [("POST", "/files"), ("POST", "/responses"), ("DELETE", "/files/file-test")])

    def test_sse_eof_and_partial_terminal_are_not_success(self):
        text = json.dumps(empty_result())
        for ending in (b"", sse_frame("response.completed", response=result_response()).rstrip()):
            transport, calls = self.stream_transport(sse_response([sse_frame("response.output_text.delta", delta=text), ending]))
            with self.subTest(ending=bool(ending)), self.assertLogs("server", level="ERROR"), self.assertRaises(server.AnalysisError) as caught:
                server.analyze_document(pdf_bytes(), "offline", "plan.pdf", "application/pdf", transport=transport)
            self.assertIn("未收到完成事件", caught.exception.message)
            self.assertEqual(calls[-1][0], "DELETE")

    def test_sse_disconnect_returns_safe_502_and_cleans_up(self):
        text = json.dumps(empty_result())
        transport, calls = self.stream_transport(sse_response([
            sse_frame("response.output_text.delta", delta=text), httpx.RemoteProtocolError("PRIVATE FILE CONTENT")
        ]))
        original = server.analyze_document
        with patch.object(server, "analyze_document", side_effect=lambda *args: original(*args, transport=transport)), self.assertLogs("server", level="ERROR") as logs:
            response = self.post()
        self.assertEqual(response.status_code, 502)
        self.assertNotIn("result", response.json)
        self.assertIn("连接中断", response.json["error"])
        self.assertIn("RemoteProtocolError", "\n".join(logs.output))
        self.assertNotIn("PRIVATE FILE CONTENT", response.text + "\n".join(logs.output))
        self.assertEqual(calls[-1][0], "DELETE")

    def test_sse_idle_read_timeout_returns_504(self):
        transport, calls = self.stream_transport(sse_response([httpx.ReadTimeout("private")]))
        with self.assertLogs("server", level="ERROR"), self.assertRaises(server.AnalysisError) as caught:
            server.analyze_document(pdf_bytes(), "offline", "plan.pdf", "application/pdf", transport=transport)
        self.assertEqual(caught.exception.status, 504)
        self.assertEqual(calls[-1][0], "DELETE")

    def test_sse_malformed_or_no_deltas_does_not_use_terminal_output(self):
        for chunks in ([b"data: invalid JSON\n\n"], [b"data: [DONE]\n\n"],
                       [sse_frame("response.completed", response=result_response())],
                       [sse_frame("response.completed", response={"status": "incomplete"})]):
            transport, calls = self.stream_transport(sse_response(chunks))
            with self.subTest(chunks=chunks), self.assertLogs("server", level="ERROR"), self.assertRaises(server.AnalysisError):
                server.analyze_document(pdf_bytes(), "offline", "plan.pdf", "application/pdf", transport=transport)
            self.assertEqual(calls[-1][0], "DELETE")

    def test_sse_stage_logs_and_multiline_event(self):
        text = json.dumps(empty_result())
        # SSE permits multiline data and event type supplied in the event field.
        chunk = ('event: response.output_text.delta\ndata: {\ndata: "delta": ' + json.dumps(text) + '}\n\n').encode()
        transport, _calls = self.stream_transport(sse_response([
            b": keepalive\n\n", sse_frame("response.reasoning_text.delta", delta="PRIVATE REASONING"),
            chunk, sse_frame("response.completed", response=result_response()),
        ]))
        with self.assertLogs("server", level="WARNING") as logs:
            result = server.analyze_document(pdf_bytes(), "offline-key", "plan.pdf", "application/pdf", transport=transport)
        message = "\n".join(logs.output)
        self.assertEqual(len(result), 5)
        for stage in ("started elapsed=", "first_event elapsed=", "completed elapsed="):
            self.assertIn(stage, message)
        self.assertNotIn("PRIVATE REASONING", message)
        self.assertNotIn("offline-key", message)
        self.assertNotIn("原文未说明", message)

    def test_sse_heartbeats_cannot_extend_total_budget(self):
        class Heartbeats(httpx.AsyncByteStream):
            async def __aiter__(self):
                while True:
                    yield b": ping\n\n"
                    await asyncio.sleep(0.005)
        stream = httpx.Response(200, headers={"content-type": "text/event-stream"}, stream=Heartbeats())
        transport, calls = self.stream_transport(stream)
        with patch.object(server, "ANALYSIS_BUDGET_SECONDS", 0.02), self.assertLogs("server", level="ERROR"), self.assertRaises(server.AnalysisError) as caught:
            server.analyze_document(pdf_bytes(), "offline", "plan.pdf", "application/pdf", transport=transport)
        self.assertEqual(caught.exception.status, 504)
        self.assertEqual(calls[-1][0], "DELETE")
        self.assertLess(660 + server.CLEANUP_BUDGET_SECONDS, 12 * 60)


if __name__ == "__main__":
    unittest.main()
