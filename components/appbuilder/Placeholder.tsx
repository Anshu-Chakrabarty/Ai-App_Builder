export default function Placeholder({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <>
      <div className="topbar">
        <strong>{title}</strong>
      </div>
      <div className="content">
        <div className="card">
          <h1 className="page-title">{title}</h1>
          <p className="page-sub">{body}</p>
        </div>
      </div>
    </>
  );
}
