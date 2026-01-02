import { ReactNode } from "react";

type ExperimentalLayout1Props = {
  title?: ReactNode;
  aiComponent: ReactNode;
  userComponent: ReactNode;
};



export default function ExperimentalLayout1({ title, aiComponent, userComponent }: ExperimentalLayout1Props) {


  return (
    <div> {/** Main Layout */}
      <main> {/** Main content */}
        <div>
          {title}
        </div>
        <div>
          {aiComponent}
        </div>
        <div>
          {userComponent}
        </div>
      </main>
    </div>
  )
}