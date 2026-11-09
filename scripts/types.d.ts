declare module 'wink-lemmatizer' {
  const lemmatizer: {
    noun(w: string): string;
    verb(w: string): string;
    adjective(w: string): string;
  };
  export default lemmatizer;
}
