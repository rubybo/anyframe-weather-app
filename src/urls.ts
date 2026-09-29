import { path } from "anyframe-compiler";
import Forecast from "./pages/Forecast.frame";
import Missing from "./pages/Missing.frame";

export const urlpatterns = [
  path("", Forecast, {
    name: "home",
    meta: {
      title: "Погода",
      description: "Прогноз погоды: сейчас, на ближайшие сутки и на семь дней.",
    },
  }),
  path("<path:rest>", Missing, {
    name: "missing",
    meta: {
      title: "Страница не найдена",
      description: "Такой страницы нет.",
    },
  }),
];
