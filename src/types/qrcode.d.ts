declare module "qrcode" {
  const qrcode: {
    toDataURL(value: string, options?: {
      width?: number; margin?: number; errorCorrectionLevel?: "L" | "M" | "Q" | "H";
    }): Promise<string>;
  };
  export default qrcode;
}
