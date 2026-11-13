import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource-variable/montserrat";
import App from "./App.jsx";
import "./styles.css";

const storedTheme = localStorage.getItem("nordflow_theme");
document.documentElement.dataset.theme =
  storedTheme === "dark" || storedTheme === "light" ? storedTheme : "light";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
