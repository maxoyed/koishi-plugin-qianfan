# koishi-plugin-qianfan

[![npm](https://img.shields.io/npm/v/koishi-plugin-qianfan?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-qianfan)

千帆大模型插件

基于 [千帆大模型 JSSDK](https://github.com/maxoyed/qianfan-jssdk)，支持对话、文生图功能。

## 配置方式

安装插件后，在控制台配置 `API_KEY` 和 `SECRET_KEY` 即可，获取方式参考 [百度智能云千帆大模型平台 - API 调用流程](https://cloud.baidu.com/doc/WENXINWORKSHOP/s/flfmc9do2#api-%E8%B0%83%E7%94%A8%E6%B5%81%E7%A8%8B)。

## 内置指令

### chat

`chat <prompt:text>`: 发起对话

### imagine

`imagine <prompt:text>`: 创作图像
