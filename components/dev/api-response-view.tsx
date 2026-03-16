import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/third-party/ui/dialog";

interface APIResponseProps {
  apiResponse: string;
}

export const APIResponseView: React.FC<APIResponseProps> = ({ apiResponse }) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="fixed right-4 bottom-4 z-20 bg-blue-600 text-white px-3 py-2 rounded shadow hover:bg-blue-700 transition"
          type="button"
        >
          Show API Response
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>API Response</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto">
          <pre className="whitespace-pre-wrap text-sm bg-secondary p-3 rounded overflow-x-auto">
            {apiResponse}
          </pre>
        </div>
        <DialogClose asChild>
          <button
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            type="button"
          >
            Close
          </button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
};
