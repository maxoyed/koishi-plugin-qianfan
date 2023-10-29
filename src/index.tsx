import { Context, Schema } from 'koishi'
import { Qianfan } from 'qianfan'
import { ChatBody, ChatModel } from 'qianfan/dist/interface';
import KookBot, { Type } from '@koishijs/plugin-adapter-kook'

export const name = 'qianfan'

export interface Config {
  API_KEY: string;
  SECRET_KEY: string;
  CHAT_MODEL: ChatModel;
  SYSTEM?: string;
  OPEN_PRIVATE: boolean;
  OPEN_IMAGINE: boolean;
  OPEN_MODEL_DISPLAY: boolean;
}

export const Config: Schema<Config> = Schema.object({
  API_KEY: Schema.string().required().description("千帆大模型平台API_KEY"),
  SECRET_KEY: Schema.string()
    .required()
    .description("千帆大模型平台SECRET_KEY"),
  CHAT_MODEL: Schema.union([
    "ERNIE-Bot-4",
    "ERNIE-Bot",
    "ERNIE-Bot-turbo",
    "BLOOMZ-7B",
    "Qianfan-BLOOMZ-7B-compressed",
    "Llama-2-7b-chat",
    "Llama-2-13b-chat",
    "Llama-2-70b-chat",
    "Qianfan-Chinese-Llama-2-7B",
    "ChatGLM2-6B-32K",
    "AquilaChat-7B",
  ])
    .default("ERNIE-Bot")
    .description("对话模型"),
  SYSTEM: Schema.string()
    .role("textarea", { rows: [2, 6] })
    .max(1024)
    .description("AI人设，当前仅支持 `ERNIE-Bot` 系列模型"),
  OPEN_PRIVATE: Schema.boolean().default(false).description("是否开启私聊"),
  OPEN_IMAGINE: Schema.boolean().default(true).description("是否开启文生图"),
  OPEN_MODEL_DISPLAY: Schema.boolean()
    .default(true)
    .description("是否开启模型回显"),
});

export function apply(ctx: Context, config: Config) {
  const api_client = new Qianfan(config.API_KEY, config.SECRET_KEY)
  // 对话请求
  ctx.command("chat <prompt:text>", "对话请求").action(async ({ session }, prompt) => {
    if (session.isDirect && !config.OPEN_PRIVATE) {
      return "私聊未开启";
    }
    try {
      let body = {
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        user_id: session.userId,
      };
      if (config.SYSTEM && ["ERNIE-Bot", "ERNIE-Bot-4", "ERNIE-Bot-turbo"].includes(config.CHAT_MODEL)) {
        body["system"] = config.SYSTEM;
      }
      const resp = await api_client.chat(
        body as ChatBody<ChatModel>,
        config.CHAT_MODEL
      );
      if (resp.need_clear_history) {
        return <>
          <quote id={session.messageId} />
          <p>对话内容包含敏感信息</p>
        </>
      }
      if (config.OPEN_MODEL_DISPLAY) {
        resp.result += `\n\n对话内容由 [${config.CHAT_MODEL}] 生成`
      }
      if (session.platform === 'kook') {
        const bot = session.bot as unknown as KookBot
        if (session.isDirect) {
          await bot.internal.createDirectMessage({
            target_id: session.userId,
            type: Type.kmarkdown,
            content: resp.result,
            quote: session.messageId,
          });
        } else {
          await bot.internal.createMessage({
            type: Type.kmarkdown,
            target_id: session.channelId,
            content: resp.result,
            quote: session.messageId
          })
        }
      } else {
        return (
          <>
            <quote id={session.messageId} />
            <p>{resp.result}</p>
          </>
        );
      }
    } catch (error) {
      return "请求错误"
    }
  })
  // 文生图请求
  ctx.command("imagine <prompt:text>", "文生图请求").action(async ({ session }, prompt) => {
    if (session.isDirect && !config.OPEN_PRIVATE) {
      return "私聊未开启";
    }
    if (!config.OPEN_IMAGINE) {
      return "文生图未开启";
    }
    try {
      const resp = await api_client.text2image({
        prompt,
        user_id: session.userId,
      })
      return (
        <>
          <quote id={session.messageId} />
          <image url={"data:image/png;base64," + resp.data[0].b64_image} />
        </>
      );
    } catch (error) {
      return "请求错误"
    }
  })
}
