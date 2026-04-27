declare module "web-push" {
  type VapidDetails = {
    subject: string;
    publicKey: string;
    privateKey: string;
  };

  type PushSubscription = {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };

  type WebPushError = Error & {
    statusCode?: number;
    body?: string;
    headers?: Record<string, string>;
  };

  function setVapidDetails(subject: string, publicKey: string, privateKey: string): void;

  function sendNotification(
    subscription: PushSubscription,
    payload?: string,
    options?: Record<string, unknown>
  ): Promise<unknown>;

  const webpush: {
    setVapidDetails: typeof setVapidDetails;
    sendNotification: typeof sendNotification;
  };

  export type { PushSubscription, VapidDetails, WebPushError };
  export { sendNotification, setVapidDetails };
  export default webpush;
}
