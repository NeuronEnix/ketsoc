import { DurableObject } from "cloudflare:workers";

interface Env {
  HELLO: DurableObjectNamespace<HelloRoom>;
}

interface ApiResponse<T> {
  code: string;
  msg: string;
  data: T;
}

export class HelloRoom extends DurableObject<Env> {
  override async fetch(_req: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.ctx.acceptWebSocket(server);
    console.log("connected");
    server.send("hello");

    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer
  ): Promise<void> {
    ws.send(message);
  }

  override async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    _wasClean: boolean
  ): Promise<void> {
    console.log("disconnected");
    ws.close(code, reason);
  }
}

export default {
  async fetch(req, env, _ctx): Promise<Response> {
    if (req.headers.get("Upgrade") === "websocket") {
      const id = env.HELLO.idFromName("default");
      const stub = env.HELLO.get(id);
      return stub.fetch(req);
    }

    const body: ApiResponse<Record<string, never>> = {
      code: "OK",
      msg: "OK",
      data: {},
    };
    return Response.json(body, { status: 200 });
  },
} satisfies ExportedHandler<Env>;
