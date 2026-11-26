export const environment = {
  production: true,
  ocrEndpoint: 'https://ocr.lightningbowl.de/api/server',
  ballApiEndpoint: 'https://balls.lightningbowl.de/api/',
  emailTemplateID: 'template_qwl4l46',
  emailServiceID: 'service_4zwqeji',
  emailUserID: 'mkI2Kqg6m34U7GL8m',
  patternEndpoint: 'https://pattern.lightningbowl.de/api/',
  // TODO: the deployed rulebooks API once it has a domain; for now `npm run local` in lightningbowl-rulebooks
  rulebookApiEndpoint: 'http://localhost:3004/api/',
  analyticsEndpoint: 'https://analytics.nicolas-hoffmann.dev/api/',
  imagesUrl: 'https://images.lightningbowl.de/',
  branch: 'master',
  authBackendUrl: 'https://auth.lightningbowl.de/api',
};
