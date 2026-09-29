declare module "*.frame" {
  import type { Component } from "anyframe-compiler";
  const component: Component;
  export default component;
}
