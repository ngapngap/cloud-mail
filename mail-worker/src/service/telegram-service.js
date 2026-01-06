import orm from '../entity/orm';
import email from '../entity/email';
import settingService from './setting-service';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(timezone);
import { eq } from 'drizzle-orm';
import jwtUtils from '../utils/jwt-utils';
import emailMsgTemplate from '../template/email-msg';
import emailTextTemplate from '../template/email-text';
import emailHtmlTemplate from '../template/email-html';
import verifyUtils from '../utils/verify-utils';
import domainUtils from "../utils/domain-uitls";

const telegramService = {

	async getEmailContent(c, params) {

		const { token } = params

		const result = await jwtUtils.verifyToken(c, token);

		if (!result) {
			return emailTextTemplate('Access denied')
		}

		const emailRow = await orm(c).select().from(email).where(eq(email.emailId, result.emailId)).get();

		if (emailRow) {

			if (emailRow.content) {
				const { r2Domain } = await settingService.query(c);
				return emailHtmlTemplate(emailRow.content || '', r2Domain)
			} else {
				return emailTextTemplate(emailRow.text || '')
			}

		} else {
			return emailTextTemplate('The email does not exist')
		}

	},

	async sendEmailToBot(c, email) {
	   const { tgBotToken, tgChatId, customDomain, tgMsgTo, tgMsgFrom, tgMsgText } = await settingService.query(c);

	   const escapeMd = (text = '') => text
	       .replace(/_/g, '\\_')
	       .replace(/\*/g, '\\*')
	       .replace(/`/g, '\\`')
	       .replace(/\[/g, '\\[')
	       .replace(/\]/g, '\\]')
	       .replace(/\(/g, '\\(')
	       .replace(/\)/g, '\\)')
	       .replace(/>/g, '\\>')
	       .replace(/#/g, '\\#')
	       .replace(/\+/g, '\\+')
	       .replace(/-/g, '\\-')
	       .replace(/=/g, '\\=')
	       .replace(/\|/g, '\\|')
	       .replace(/\{/g, '\\{')
	       .replace(/\}/g, '\\}')
	       .replace(/\./g, '\\.')
	       .replace(/!/g, '\\!');

	   // ✅ Fix 1: Trim whitespace và convert sang number
	   const tgChatIds = tgChatId.split(',').map(id => {
	       const trimmedId = id.trim();
	       return isNaN(trimmedId) ? trimmedId : Number(trimmedId);
	   });

    const jwtToken = await jwtUtils.generateToken(c, { emailId: email.emailId })
    const webAppUrl = customDomain ? `${domainUtils.toOssDomain(customDomain)}/api/telegram/getEmail/${jwtToken}` : null;

    await Promise.all(tgChatIds.map(async chatId => {
        try {
            // ✅ Fix 2: Validate trước khi gửi
            if (!webAppUrl) {
                console.error(`Telegram notification skipped: no customDomain configured`);
                return;
            }

            const messageText = emailMsgTemplate(email, tgMsgTo, tgMsgFrom, tgMsgText);
            
            // ✅ Format MarkdownV2 đơn giản, loại bỏ khoảng trắng thừa và escape
            const safeText = escapeMd(messageText)
                .replace(/\n{3,}/g, '\n\n')
                .trim()
                .substring(0, 4000); // giữ dưới giới hạn Telegram
 
            const res = await fetch(`https://api.telegram.org/bot${tgBotToken}/sendMessage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    chat_id: Number(chatId),
                    parse_mode: 'MarkdownV2',
                    text: safeText,
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: 'Xem',
                                    web_app: { url: webAppUrl }
                                }
                            ]
                        ]
                    }
                })
            });

            if (!res.ok) {
                const errorText = await res.text();
                console.error(`Telegram failed: chatId=${chatId}, status=${res.status}, response=${errorText}`);
            }
        } catch (e) {
            console.error(`Telegram forward failed: chatId=${chatId}`, e.message);
        }
    }));
}
}
export default telegramService
