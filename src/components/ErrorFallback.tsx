/** ErrorFallback — explains precisely what is missing; never shows invented data instead. */
export function ErrorFallback({ message }: { message: string }) {
  return (
    <div className="loading" role="alert">
      <p className="eyebrow">Earth Information Jukebox</p>
      <h1 className="chapter-title">The source data couldn’t be loaded.</h1>
      <p>{message}</p>
      <p className="muted">
        Nothing is shown in its place: the instrument only plays verified NASA frames. If you are running locally, regenerate the data with
        <code> npm run pipeline</code> and reload.
      </p>
    </div>
  );
}
