export interface TokenizedLine {
  original: string; // The original line text
  content: string; // The line content without comments
  indent: number; // Number of leading spaces
  isComment: boolean; // True if the line is a comment
  isBlank: boolean; // True if the line is blank
  lineNumber: number; // The original line number in the YAML string
  isDirective: boolean; // True if the line is a YAML directive
  isDocumentMarker: boolean; // True if the line is a document marker (--- or ...)
}
