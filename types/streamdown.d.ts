declare module "streamdown" {
  export interface StreamdownProps {
    content?: string;
    [key: string]: any;
  }

  export const Streamdown: React.ComponentType<StreamdownProps>;
}
