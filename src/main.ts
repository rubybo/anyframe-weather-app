import { router } from "anyframe-compiler";
import { urlpatterns } from "./urls";

const root = document.querySelector("#app");
if (!(root instanceof Element)) {
  throw new Error("Missing #app");
}

router(urlpatterns, root);
