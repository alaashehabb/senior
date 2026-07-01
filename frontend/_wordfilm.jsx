import { StrictMode, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import ASLWordStickman from "./src/components/ASLWordStickman";
import "./src/index.css";

function Harness({ word, grabTimes }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const root = containerRef.current;
    const wordBtn = [...root.querySelectorAll("button")].find((b) => b.textContent === word);
    wordBtn?.click();

    const t0 = setTimeout(() => {
      const playBtn = [...root.querySelectorAll("button")].find((b) => b.textContent.includes("Play"));
      playBtn?.click();
    }, 150);

    const canvas = () => root.querySelector("canvas");
    const timers = grabTimes.map((ms) =>
      setTimeout(() => {
        const c = canvas();
        if (!c) return;
        const data = c.toDataURL("image/png");
        fetch("http://localhost:8793/report", { method: "POST", body: `${word}|${ms}|${data}` }).catch(() => {});
      }, ms + 150),
    );

    return () => {
      clearTimeout(t0);
      timers.forEach(clearTimeout);
    };
  }, [word, grabTimes]);

  return (
    <div ref={containerRef} style={{ display: "inline-block", margin: 8 }}>
      <ASLWordStickman />
    </div>
  );
}

const root = document.createElement("div");
root.style.display = "flex";
root.style.flexWrap = "wrap";
document.body.appendChild(root);

const T12 = [200, 500, 800, 1100, 1400, 1700, 2000, 2300, 2600, 2900, 3200, 3500];

createRoot(root).render(
  <StrictMode>
    <Harness word="MORE" grabTimes={T12} />
    <Harness word="HELP" grabTimes={T12} />
    <Harness word="GO" grabTimes={T12} />
    <Harness word="STOP" grabTimes={T12} />
    <Harness word="LEARN" grabTimes={T12} />
    <Harness word="NAME" grabTimes={T12} />
  </StrictMode>,
);
