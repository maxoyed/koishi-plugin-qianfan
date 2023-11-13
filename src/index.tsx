import { Context, Schema, Logger, Fragment, Session } from "koishi";
import { Type } from "@koishijs/plugin-adapter-kook";
import {} from "@koishijs/plugin-adapter-kook";
import { QianfanService } from "./service";
import { ChatBody, ChatModel } from "qianfan/dist/interface";

export const name = "qianfan";
export const inject = ["database"];

const logger = new Logger(name);

export interface Config {
  API_KEY: string;
  SECRET_KEY: string;
  CHAT_MODEL: ChatModel;
  SYSTEM?: string;
  temperature?: number;
  top_p?: number;
  penalty_score?: number;
  OPEN_HISTORY: boolean;
  HISTORY_ROUND: number;
  OPEN_IMAGINE: boolean;
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    API_KEY: Schema.string().required(),
    SECRET_KEY: Schema.string().required().role("secret"),
  }).description("服务配置"),
  Schema.object({
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
    temperature: Schema.number()
      .role("slider")
      .step(0.01)
      .default(0.95)
      .min(0.01)
      .max(1)
      .description(
        "较高的数值会使输出更加随机，而较低的数值会使其更加集中和确定\n\n建议该参数和 `top_p` 只设置1个"
      ),
    top_p: Schema.number()
      .role("slider")
      .step(0.01)
      .default(0.8)
      .min(0)
      .max(1)
      .description(
        "影响输出文本的多样性，取值越大，生成文本的多样性越强\n\n建议该参数和 `temperature` 只设置 1 个"
      ),
    penalty_score: Schema.number()
      .role("slider")
      .step(0.01)
      .default(1.0)
      .min(1)
      .max(2)
      .description(
        "通过对已生成的token增加惩罚，减少重复生成的现象，值越大表示惩罚越大"
      ),
    OPEN_HISTORY: Schema.boolean()
      .default(false)
      .description("是否开启多轮对话"),
    HISTORY_ROUND: Schema.number().default(10).description("多轮对话最大轮数"),
    OPEN_IMAGINE: Schema.boolean().default(true).description("是否开启文生图"),
  }).description("插件配置"),
]);

export function apply(ctx: Context, config: Config) {}

// export function apply(ctx: Context, config: Config) {
//   ctx.plugin(QianfanService, config);
//   // 对话处理器
//   async function chatHandler(
//     cmd: string,
//     prompt: string,
//     uid: number,
//     userId: string,
//     target_id: string,
//     messageId: string,
//     quoteMsgId?: string,
//     system?: string
//   ): Promise<{
//     should_save: boolean;
//     should_reply: boolean;
//     cmd: string;
//     startMessageId: string;
//     system: string;
//     text: string;
//     jsx: Fragment;
//     kmarkdown: {
//       type: Type;
//       target_id: string;
//       content: string;
//       quote: string;
//     };
//     promptTokens: number;
//     completionTokens: number;
//   }> {
//     let startMessageId = messageId;
//     try {
//       // 基础请求参数
//       let body = {
//         messages: [
//           {
//             role: "user",
//             content: prompt,
//           },
//         ],
//         user_id: userId,
//       };
//       // 多轮对话处理
//       if (quoteMsgId) {
//         const record = await ctx.database.get("qianfan_history", {
//           uid,
//           role: "assistant",
//           currentMessageId: quoteMsgId,
//         });
//         if (record.length > 0) {
//           startMessageId = record[0].startMessageId;
//           cmd = record[0].command;
//           system = record[0].system;
//           const history = await ctx.database
//             .select("qianfan_history")
//             .where({
//               uid,
//               startMessageId,
//               createdAt: {
//                 $lte: record[0].createdAt,
//               },
//             })
//             .orderBy("createdAt", "desc")
//             .limit(config.HISTORY_ROUND)
//             .execute();
//           logger.debug({ history });
//           history.reverse();
//           if (history[0].role === "assistant") {
//             history.shift();
//           }
//           if (history[history.length - 1].role === "user") {
//             history.pop();
//           }
//           logger.debug({ history });
//           body.messages.unshift(
//             ...history.map((item) => ({
//               role: item.role,
//               content: item.content,
//             }))
//           );
//         } else {
//           return {
//             should_save: false,
//             should_reply: false,
//             cmd,
//             startMessageId,
//             system,
//             text: "只能回复自己发起的对话",
//             jsx: (
//               <>
//                 <quote id={messageId} />
//                 <p>只能回复自己发起的对话</p>
//               </>
//             ),
//             kmarkdown: {
//               type: Type.kmarkdown,
//               target_id: target_id,
//               content: "(font)只能回复自己发起的对话(font)[warning]",
//               quote: messageId,
//             },
//             promptTokens: 0,
//             completionTokens: 0,
//           };
//         }
//       }
//       // 系统人设处理
//       if (system) {
//         body["system"] = system || config.SYSTEM;
//       }
//       // 模型参数处理
//       if (
//         config.SYSTEM.length > 0 &&
//         ["ERNIE-Bot", "ERNIE-Bot-4", "ERNIE-Bot-turbo"].includes(
//           config.CHAT_MODEL
//         )
//       ) {
//         body["penalty_score"] = config.penalty_score;
//         if (config.temperature !== 0.95) {
//           body["temperature"] = config.temperature;
//         } else if (config.top_p !== 0.8) {
//           body["top_p"] = config.top_p;
//         }
//       }
//       // 请求对话
//       const resp = await ctx.qianfan.chat(
//         body as ChatBody<ChatModel>,
//         config.CHAT_MODEL
//       );
//       logger.debug({ body });
//       logger.debug({ resp });
//       // 处理敏感消息
//       if (resp.need_clear_history) {
//         return {
//           should_save: false,
//           should_reply: true,
//           cmd,
//           startMessageId,
//           system,
//           text: "对话内容包含敏感信息",
//           jsx: (
//             <>
//               <quote id={messageId} />
//               <p>对话内容包含敏感信息</p>
//             </>
//           ),
//           kmarkdown: {
//             type: Type.kmarkdown,
//             target_id: target_id,
//             content: "(font)对话内容包含敏感信息(font)[warning]",
//             quote: messageId,
//           },
//           promptTokens: resp.usage.prompt_tokens,
//           completionTokens: resp.usage.completion_tokens,
//         };
//       }
//       // 正常响应
//       return {
//         should_save: true,
//         should_reply: true,
//         cmd,
//         startMessageId,
//         system,
//         text: resp.result,
//         jsx: (
//           <>
//             <quote id={messageId} />
//             <p>{resp.result}</p>
//           </>
//         ),
//         kmarkdown: {
//           type: Type.kmarkdown,
//           target_id: target_id,
//           content: resp.result,
//           quote: messageId,
//         },
//         promptTokens: resp.usage.prompt_tokens,
//         completionTokens: resp.usage.completion_tokens,
//       };
//     } catch (error) {
//       logger.error(error);
//       // 错误响应
//       return {
//         should_save: false,
//         should_reply: true,
//         cmd,
//         startMessageId,
//         system,
//         text: "请求错误",
//         jsx: (
//           <>
//             <quote id={messageId} />
//             <p>请求错误</p>
//           </>
//         ),
//         kmarkdown: {
//           type: Type.kmarkdown,
//           target_id: target_id,
//           content: "(font)请求错误(font)[error]",
//           quote: messageId,
//         },
//         promptTokens: 0,
//         completionTokens: 0,
//       };
//     }
//   }
//   // 多轮对话中间件
//   ctx.middleware(async (session: Session<"id">, next) => {
//     if (session.quote) {
//       if (session.platform === "qq") {
//         logger.debug("处理多轮对话：当前平台不支持多轮对话");
//         await session.send("当前平台不支持多轮对话");
//         return;
//       } else if (!config.OPEN_HISTORY) {
//         logger.debug("处理多轮对话：多轮对话未开启");
//         await session.send("多轮对话未开启");
//         return;
//       } else if (session.content.length === 0) {
//         logger.debug("处理多轮对话：空消息");
//         return;
//       } else {
//         logger.debug("处理多轮对话：start");
//         await session.observeUser(["id"]);
//         let should_reply = true;
//         session.content = session.content.replace(/<at.*?\/>/g, "").trim();
//         logger.debug("处理多轮对话：", session.content);
//         try {
//           let target_id = session.userId;
//           if (!session.isDirect) {
//             target_id = session.channelId;
//           }
//           logger.debug({ target_id });
//           const resp = await chatHandler(
//             "unknown",
//             session.content,
//             session.user.id,
//             session.userId,
//             target_id,
//             session.messageId,
//             session.quote.id
//           );
//           should_reply = resp.should_reply;
//           // 发送消息
//           let sendMsgId: string;
//           if (should_reply) {
//             // kook平台启用kmarkdown
//             if (session.kook) {
//               if (session.isDirect) {
//                 const sendResp = await session.kook.createDirectMessage(
//                   resp.kmarkdown
//                 );
//                 sendMsgId = sendResp.msg_id;
//               } else {
//                 const sendResp = await session.kook.createMessage(
//                   resp.kmarkdown
//                 );
//                 sendMsgId = sendResp.msg_id;
//               }
//             } else {
//               const sendResp = await session.send(resp.jsx);
//               sendMsgId = sendResp?.[0];
//             }
//           }
//           logger.debug({ sendMsgId });
//           // 保存对话
//           if (sendMsgId && resp.should_save) {
//             await ctx.database.create("qianfan_history", {
//               uid: session.user.id,
//               startMessageId: resp.startMessageId,
//               currentMessageId: session.messageId,
//               model: config.CHAT_MODEL,
//               command: resp.cmd,
//               role: "user",
//               content: session.content,
//               system: resp.system,
//               usageTokens: resp.promptTokens,
//               createdAt: new Date(),
//             });
//             await ctx.database.create("qianfan_history", {
//               uid: session.user.id,
//               startMessageId: resp.startMessageId,
//               currentMessageId: sendMsgId,
//               model: config.CHAT_MODEL,
//               command: resp.cmd,
//               role: "assistant",
//               content: resp.text,
//               system: resp.system,
//               usageTokens: resp.completionTokens,
//               createdAt: new Date(Date.now() + 1000),
//             });
//           }
//         } catch (error) {
//           logger.error(error);
//           if (should_reply) {
//             await session.send("请求错误");
//           }
//         }
//         return;
//       }
//     } else {
//       next();
//     }
//   });
//   // 对话请求
//   ctx
//     .command("chat <prompt:text>", "对话请求")
//     .userFields(["id"])
//     .action(async ({ session }, prompt) => {
//       if (!prompt) {
//         return "请输入对话内容";
//       }
//       let should_reply = true;
//       try {
//         let target_id = session.userId;
//         if (!session.isDirect) {
//           target_id = session.channelId;
//         }
//         let system: string;
//         if (
//           config.SYSTEM.length > 0 &&
//           ["ERNIE-Bot", "ERNIE-Bot-4", "ERNIE-Bot-turbo"].includes(
//             config.CHAT_MODEL
//           )
//         ) {
//           system = config.SYSTEM.slice(0, 1024);
//         }
//         const resp = await chatHandler(
//           "chat",
//           prompt,
//           session.user.id,
//           session.userId,
//           target_id,
//           session.messageId,
//           session.quote?.id,
//           system
//         );
//         should_reply = resp.should_reply;
//         // 发送消息
//         let sendMsgId: string;
//         if (should_reply) {
//           // kook平台启用kmarkdown
//           if (session.kook) {
//             if (session.isDirect) {
//               const sendResp = await session.kook.createDirectMessage(
//                 resp.kmarkdown
//               );
//               sendMsgId = sendResp.msg_id;
//             } else {
//               const sendResp = await session.kook.createMessage(resp.kmarkdown);
//               sendMsgId = sendResp.msg_id;
//             }
//           } else {
//             const sendResp = await session.send(resp.jsx);
//             sendMsgId = sendResp?.[0];
//           }
//         }
//         // 保存对话
//         if (sendMsgId && resp.should_save) {
//           await ctx.database.create("qianfan_history", {
//             uid: session.user.id,
//             startMessageId: resp.startMessageId,
//             currentMessageId: session.messageId,
//             model: config.CHAT_MODEL,
//             command: resp.cmd,
//             role: "user",
//             content: prompt,
//             system,
//             usageTokens: resp.promptTokens,
//             createdAt: new Date(),
//           });
//           await ctx.database.create("qianfan_history", {
//             uid: session.user.id,
//             startMessageId: resp.startMessageId,
//             currentMessageId: sendMsgId,
//             model: config.CHAT_MODEL,
//             command: resp.cmd,
//             role: "assistant",
//             content: resp.text,
//             system,
//             usageTokens: resp.completionTokens,
//             createdAt: new Date(Date.now() + 1000),
//           });
//         }
//       } catch (error) {
//         logger.error(error);
//         if (should_reply) {
//           return "请求错误";
//         }
//       }
//     });
//   // 文生图请求
//   ctx
//     .command("imagine <prompt:text>", "文生图请求")
//     .action(async ({ session }, prompt) => {
//       if (!config.OPEN_IMAGINE) {
//         return "文生图未开启";
//       }
//       try {
//         const resp = await api_client.text2image({
//           prompt,
//           user_id: session.userId,
//         });
//         return (
//           <>
//             <at id={session.userId} />
//             <image url={"data:image/png;base64," + resp.data[0].b64_image} />
//           </>
//         );
//       } catch (error) {
//         return "请求错误";
//       }
//     });

//   // 人生重开模拟器
//   ctx
//     .command("remake", "人生重开模拟器")
//     .userFields(["id"])
//     .action(async ({ session }) => {
//       const system = `
// ## 《人生重开模拟器》游戏规则
// 1. 游戏开始时，我一共有20个天赋点可以分配到“智力”、“颜值”、“体质”、“家境”上。
// 2. 你给出的事件必须是具体的某件事，每一个事件需要至少包含事件发生时我的年龄、事件的详细描述、事件中其他人物的姓名，你需要在事件发生时提供四个选项（A,B,C,D）并询问我的选择。然后不断地基于我的选择推进剧情发展，告诉我每次选择之后的结果。
// 3. 剧情发展与天赋点分配强相关。事件中所有出现的人物都有自己的性格和个性，事件之间有一定的相关性。
// 4. 游戏不超过8个事件。
//     `;
//       const prompt = `
// 让我们来玩一款名为《人生重开模拟器》的游戏。你需要不断地基于我的选择推进剧情发展。我在游戏中扮演一个角色。我做出自己的选择和行动，去影响这一切。这个游戏的发展是令人意想不到的，充满惊喜，跌宕起伏的，趣味十足的。

// 现在，游戏开始，请询问我的天赋点分配方案：
//     `;
//       let should_reply = true;
//       try {
//         let target_id = session.userId;
//         if (!session.isDirect) {
//           target_id = session.channelId;
//         }
//         const resp = await chatHandler(
//           "remake",
//           prompt,
//           session.user.id,
//           session.userId,
//           target_id,
//           session.messageId,
//           session.quote?.id,
//           system
//         );
//         should_reply = resp.should_reply;
//         // 发送消息
//         let sendMsgId: string;
//         if (should_reply) {
//           // kook平台启用kmarkdown
//           if (session.kook) {
//             if (session.isDirect) {
//               const sendResp = await session.kook.createDirectMessage(
//                 resp.kmarkdown
//               );
//               sendMsgId = sendResp.msg_id;
//             } else {
//               const sendResp = await session.kook.createMessage(resp.kmarkdown);
//               sendMsgId = sendResp.msg_id;
//             }
//           } else {
//             const sendResp = await session.send(resp.jsx);
//             sendMsgId = sendResp?.[0];
//           }
//         }
//         // 保存对话
//         if (sendMsgId && resp.should_save) {
//           await ctx.database.create("qianfan_history", {
//             uid: session.user.id,
//             startMessageId: resp.startMessageId,
//             currentMessageId: session.messageId,
//             model: config.CHAT_MODEL,
//             command: resp.cmd,
//             role: "user",
//             content: prompt,
//             system,
//             usageTokens: resp.promptTokens,
//             createdAt: new Date(),
//           });
//           await ctx.database.create("qianfan_history", {
//             uid: session.user.id,
//             startMessageId: resp.startMessageId,
//             currentMessageId: sendMsgId,
//             model: config.CHAT_MODEL,
//             command: resp.cmd,
//             role: "assistant",
//             content: resp.text,
//             system,
//             usageTokens: resp.completionTokens,
//             createdAt: new Date(Date.now() + 1000),
//           });
//         }
//       } catch (error) {
//         logger.error(error);
//         if (should_reply) {
//           return "请求错误";
//         }
//       }
//     });
// }
