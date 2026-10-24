import { HomePageRouter } from "./home-page-router";

type HomeProps = {
  initialSignedOut?: boolean;
};

export default function Home({ initialSignedOut }: HomeProps) {
  return <HomePageRouter initialSignedOut={initialSignedOut} />;
}
