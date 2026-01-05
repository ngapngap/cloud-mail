import emailUtils from '../utils/email-utils';
export default function emailMsgTemplate(email, tgMsgTo, tgMsgFrom, tgMsgText) {
  let template = `<b>${email.subject}</b>`
  if (tgMsgFrom === 'only-name') {
    template += `<br>Người gửi: ${email.name}`
  }
  if (tgMsgFrom === 'show') {
    template += `<br>Người gửi: ${email.name} <${email.sendEmail}>`
  }
  if(tgMsgTo === 'show' && tgMsgFrom === 'hide') {
    template += `<br>Người nhận: \u200B${email.toEmail}`
  } else if(tgMsgTo === 'show') {
    template += `<br>Người nhận: \u200B${email.toEmail}`
  }
  const text = (email.text || emailUtils.htmlToText(email.content))
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  if(tgMsgText === 'show') {
    template += `<br>${text}`
  }
  return template;
}
