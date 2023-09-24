export interface ArkiveRecord {
  id: number;
  deployment: DeploymentRecord;
}

export interface DeploymentRecord {
  id: number;
  stage: string;
}
