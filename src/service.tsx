import { Context, Service, Session } from "koishi";
import { Config } from ".";
import { Qianfan } from "qianfan";
import { ChatBody, ChatModel, Text2ImageBody } from "qianfan/dist/interface";

export interface QianfanHistory {
  id: number;
  uid: number;
  startMessageId: string;
  currentMessageId: string;
  model: ChatModel;
  command: string;
  role: "user" | "assistant";
  content: string;
  system: string;
  usageTokens: number;
  createdAt: Date;
}

export interface QianfanReplyEventMessage {
  command: string;
  model: string;
  system: string;
  startMessageId: string;
  messages: {
    role: "user" | "assistant";
    content: string;
  }[];
}

declare module "koishi" {
  interface Context {
    qianfan: QianfanService;
  }
  interface Events {
    "qianfan/reply"(args: QianfanReplyEventMessage): void;
  }
  interface Tables {
    qianfan: QianfanHistory;
  }
}

export class QianfanService extends Service {
  private client: Qianfan;
  constructor(public ctx: Context, public config: Config) {
    super(ctx, "qianfan", true);
    this.client = new Qianfan(config.API_KEY, config.SECRET_KEY);
    // 扩展数据库
    ctx.model.extend(
      "qianfan",
      {
        id: "unsigned",
        uid: {
          type: "unsigned",
          nullable: false,
        },
        startMessageId: "string",
        currentMessageId: {
          type: "string",
          nullable: false,
        },
        model: "string",
        command: "string",
        role: "string",
        content: "text",
        system: "text",
        usageTokens: "integer",
        createdAt: "timestamp",
      },
      {
        autoInc: true,
        unique: [["currentMessageId"]],
        foreign: {
          uid: ["user", "id"],
        },
      }
    );
    // 多轮对话中间件
    ctx.middleware(async (session: Session<"id">, next) => {
      if (session.quote) {
        await session.observeUser(["id"]);
        const [quoteMsg] = await ctx.database.get("qianfan", {
          uid: session.user.id,
          currentMessageId: session.quote.id,
        });
        if (quoteMsg) {
          const records = await ctx.database.get("qianfan", {
            uid: session.user.id,
            command: quoteMsg.command,
            startMessageId: quoteMsg.startMessageId,
          });
          ctx.emit(session, "qianfan/reply", {
            command: quoteMsg.command,
            model: quoteMsg.model,
            system: quoteMsg.system,
            startMessageId: quoteMsg.startMessageId,
            messages: records.map((row) => {
              return {
                role: row.role,
                content: row.content,
              };
            }),
          });
        }
      }
      return await next();
    });
  }

  /**
   * 保存消息记录
   * @param params 消息记录
   */
  async saveMsg(params: QianfanHistory) {
    await this.ctx.database.create("qianfan", params);
  }

  /**
   * 发起单轮对话请求
   * @param prompt 提示词
   * @param model 使用的模型
   * @param open_history 是否开启多轮对话
   */
  async chat<T extends ChatModel>(
    body: ChatBody<T>,
    model: T = this.config.CHAT_MODEL as T
  ) {
    const resp = await this.client.chat(body, model);
    this.logger.debug({
      command: this.caller.command,
      body,
      resp,
    });
    return resp;
  }

  /**
   * 发起文生图请求
   * @param body 请求体
   */
  async imagine(body: Text2ImageBody) {
    const resp = await this.client.text2image(body);
    this.logger.debug({
      cmd: this.caller.command,
      body,
      resp,
    });
    return resp.data[0].b64_image;
  }
}
