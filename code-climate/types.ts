export type AnalysisFormats = 'json' | 'text' | 'html';
export type TaskConfig = {
  configFilePath: string;
  analysisFormat: AnalysisFormats;
  sourcePath: string;
  outputPath: string;
  debug: boolean;
  engineTimeout: number;
  memLimit: number;
};
