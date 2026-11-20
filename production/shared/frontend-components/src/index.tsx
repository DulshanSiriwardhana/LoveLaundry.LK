import type { ReactNode } from "react";
import { cx } from "./utilities";

export function Panel(props: { title?: string; children: ReactNode }) {
  return (
    <section className={cx("panel", props.title && "panel-title")}>
      {props.title ? <h2>{props.title}</h2> : null}
      {props.children}
    </section>
  );
}
