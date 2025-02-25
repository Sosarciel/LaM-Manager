import { AnyTextCompletionRespFormat, DefChatLaMResult } from '@/TextCompletion/TextCompletionInterface';
import { PromiseRetryResult, SLogger } from "@zwa73/utils";
import { OpenAIChatModel } from "./GPTChatInterface";
import { OpenAIChatAPIEntry, OpenAIChatAPIResp, formatOpenAIChatApiReq, transOpenAIChatApiReq } from "APITool";
import { ChatTaskOption, LaMChatMessages } from '@/TextCompletion/ChatTaskInterface';
import { IChatFormater } from '@/TextCompletion/ChatFormatAdapter';
import { getTokensizer, TokensizerType } from '@/src/Tokensize';
import { AnyOpenAIChatRespFormat } from '../Resp';

/**turbo模型配置 */
export type OpenAIChatOption={
    model: OpenAIChatModel;
    messages: OpenAIChatAPIEntry[];
    max_tokens: number;
    temperature: number;
    top_p: number;
    stop: string[]|null;
    presence_penalty: number;
    frequency_penalty: number;
    logit_bias: Record<string, number>|null;
    n: number;
}

class _OpenAIChatFormater implements IChatFormater{
    formatOption(opt:ChatTaskOption,model:string):OpenAIChatOption|undefined{
        //验证参数
        if(opt.messages==null){
            SLogger.warn("TurboOptions 无效 messages为null");
            return;
        }
        if(opt.messages.length==0){
            SLogger.warn("TurboOptions 无效 messages长度不足");
            return;
        }

        let turboMessahge = transOpenAIChatApiReq(opt.target,opt.messages);
        turboMessahge = formatOpenAIChatApiReq(opt.target,turboMessahge);

        return {
            model             : model as OpenAIChatModel,//模型id
            messages          : turboMessahge           ,//提示
            max_tokens        : opt.max_tokens          ,//最大生成令牌数
            temperature       : opt.temperature         ,//temperature 权重控制 0为最准确 越大越偏离主题
            top_p             : opt.top_p               ,//top_p       权重控制 0为最准确 越大越偏离主题
            n                 : opt.n                   ,//产生n条消息
            presence_penalty  : opt.presence_penalty    ,//遭遇时将会停止生成的最多4个字符串 "1234"
            frequency_penalty : opt.frequency_penalty   ,//重复惩罚 alpha_presence  越大越不容易生成重复词 重复出现时的固定惩罚
            logit_bias        : opt.logit_bias          ,//重复惩罚 alpha_frequency 越大越不容易生成重复词 每次重复时的累计惩罚
            //best_of         : best_of                 ,//产生n条候选消息，根据n返回n条最佳消息
            stop              : opt.stop                ,//调整某token出现的概率 {"tokenid":-100~100}
        };

        //频率惩罚计算函数
        //mu[j] -> mu[j] - c[j] * alpha_frequency - float(c[j] > 0) * alpha_presence
    }
    async calcToken(message: LaMChatMessages, tokensizerType: TokensizerType) {
        const turboMessage = transOpenAIChatApiReq('unknown',message);
        const tokenizer = getTokensizer(tokensizerType);
        return (await tokenizer.encode(JSON.stringify(turboMessage))).length;
    }
    formatResp(resp:PromiseRetryResult<AnyTextCompletionRespFormat | undefined> | undefined){
        if(resp==null) return DefChatLaMResult;
        return {
            completed:resp.completed ? new OpenAIChatAPIResp(resp.completed as AnyOpenAIChatRespFormat) : undefined,
            pending:resp.pending.map(async p=>{
                const res = await p;
                if(p==null) return undefined;
                return new OpenAIChatAPIResp(res as AnyOpenAIChatRespFormat);
            })
        };
    };
}

export const OpenAIChatFormater = new _OpenAIChatFormater();
