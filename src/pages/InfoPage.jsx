import { ROUTES } from "../lib/nav";
import HowItWorksPage from "./info/HowItWorksPage";
import SecurityPage from "./info/SecurityPage";
import AboutPage from "./info/AboutPage";

const PAGES = {
  [ROUTES.howItWorks]: HowItWorksPage,
  [ROUTES.security]: SecurityPage,
  [ROUTES.about]: AboutPage,
};

/** One of the public information pages (how it works, security, about), readable signed in or out. */
export default function InfoPage({ path }) {
  const Page = PAGES[path];
  return <Page />;
}
