import { glass } from "../primitives";

export const ChatInput = () => {
  return (
    <div className="absolute bottom-0 left-0 h-80 w-full min-w-2xl max-w-5xl bg-amber-300">
      <div className={glass()}>
        <div>Hey</div>
      </div>
    </div>
  );
};
