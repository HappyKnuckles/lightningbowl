export interface ForwardsData {
  buf: string;
  distance_end: string;
  // this is the y-axis, start from foul line and end 60ft total
  distance_start: string;
  load: string;
  mics: string;
  number: string;
  speed: string;
  // start is the starting board 1L first left board, 1R first right board, 39 total boards; x axis
  start: string;
  stop: string;

  tank: string;
  total_oil: string;
}

export interface ReverseData {
  buf: string;
  distance_end: string;
  distance_start: string;
  load: string;
  mics: string;
  number: string;
  speed: string;
  start: string;
  stop: string;
  tank: string;
  total_oil: string;
}

export interface Pattern {
  category: string;
  chart_horizontal: string;
  chart_standard: string;
  distance: string;
  forward: string;
  forwards_data: ForwardsData[];
  kosi_url: string;
  pdf_url: string;
  pump: string;
  ratio?: string;
  reverse: string;
  reverse_data: ReverseData[];
  tanks?: string;
  title: string;
  url: string;
  volume: string;
}
