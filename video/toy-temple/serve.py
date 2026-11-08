# Static server rooted at the project + POST /frame/<n> saves rendered frames.
import http.server, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
FRAMES = os.path.join(HERE, 'frames')
os.makedirs(FRAMES, exist_ok=True)


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def do_POST(self):
        if not self.path.startswith('/frame/'):
            self.send_error(404)
            return
        n = int(self.path.rsplit('/', 1)[-1])
        data = self.rfile.read(int(self.headers['Content-Length']))
        with open(os.path.join(FRAMES, f'f{n:04d}.jpg'), 'wb') as f:
            f.write(data)
        self.send_response(200)
        self.end_headers()

    def log_message(self, *a):
        pass


http.server.ThreadingHTTPServer(('127.0.0.1', 8472), H).serve_forever()
