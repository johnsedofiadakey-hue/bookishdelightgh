import type { AdminGuide } from "@/lib/admin/guides";
/** Steps, buttons and tips for one page. Also used on the Help page. */
export function GuideContent({ guide, foldButtons = false }: { guide: AdminGuide; foldButtons?: boolean }) {
  return (
    <>
      <h3 className="adm-guide-heading">How to use it</h3>
      <ol>{guide.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      {guide.buttons?.length ? (
        foldButtons ? (
          <details className="adm-guide-fold">
            <summary>What each button does ({guide.buttons.length})</summary>
            <ButtonList guide={guide} />
          </details>
        ) : (
          <>
            <h3 className="adm-guide-heading">What each button does</h3>
            <ButtonList guide={guide} />
          </>
        )
      ) : null}
      {guide.tips?.length ? <div className="adm-guide-tips"><strong>Good to know</strong><ul>{guide.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul></div> : null}
    </>
  );
}

function ButtonList({ guide }: { guide: AdminGuide }) {
  return (
    <dl className="adm-guide-buttons">
      {guide.buttons!.map((button) => (
        <div key={button.label}>
          <dt>{button.label}</dt>
          <dd>{button.does}</dd>
        </div>
      ))}
    </dl>
  );
}
