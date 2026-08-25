const ballDistributionZonePlugin = {
  id: 'ballDistributionZones',
  beforeDatasetsDraw(chart: { chartArea: any; ctx: any; scales: any; }) {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea || !scales['x'] || !scales['y']) return;
    ctx.save();

    const xRanges = [
      { min: scales['x'].min, max: 0.035, label: 'Low Diff' },
      { min: 0.035, max: 0.05, label: 'Med Diff' },
      { min: 0.05, max: scales['x'].max, label: 'High Diff' },
    ];
    const yRanges = [
      { min: scales['y'].min, max: 2.52, label: 'Low RG' },
      { min: 2.52, max: 2.58, label: 'Med RG' },
      { min: 2.58, max: scales['y'].max, label: 'High RG' },
    ];
    const zoneStyles = [
      { color: 'rgba(220,20,60,0.05)', borderColor: 'rgba(220,20,60,0.3)', textColor: '#F5F5F5' },
      { color: 'rgba(255,140,0,0.05)', borderColor: 'rgba(255,140,0,0.3)', textColor: '#F5F5F5' },
      { color: 'rgba(255,215,0,0.05)', borderColor: 'rgba(255,215,0,0.3)', textColor: '#F5F5F5' },
      { color: 'rgba(30,144,255,0.05)', borderColor: 'rgba(30,144,255,0.3)', textColor: '#F5F5F5' },
      { color: 'rgba(128,128,128,0.05)', borderColor: 'rgba(128,128,128,0.3)', textColor: '#F5F5F5' },
      { color: 'rgba(34,139,34,0.05)', borderColor: 'rgba(34,139,34,0.3)', textColor: '#F5F5F5' },
      { color: 'rgba(147,112,219,0.05)', borderColor: 'rgba(147,112,219,0.3)', textColor: '#F5F5F5' },
      { color: 'rgba(75,0,130,0.05)', borderColor: 'rgba(75,0,130,0.3)', textColor: '#F5F5F5' },
      { color: 'rgba(0,139,139,0.05)', borderColor: 'rgba(0,139,139,0.3)', textColor: '#F5F5F5' },
    ];

    let idx = 0;
    for (const yR of yRanges) {
      for (const xR of xRanges) {
        const style = zoneStyles[idx++];
        const x1 = scales['x'].getPixelForValue(xR.min);
        const x2 = scales['x'].getPixelForValue(xR.max);
        const y1 = scales['y'].getPixelForValue(yR.max);
        const y2 = scales['y'].getPixelForValue(yR.min);
        const left = Math.max(chartArea.left, Math.min(x1, x2));
        const right = Math.min(chartArea.right, Math.max(x1, x2));
        const top = Math.max(chartArea.top, Math.min(y1, y2));
        const bottom = Math.min(chartArea.bottom, Math.max(y1, y2));
        const width = right - left;
        const height = bottom - top;
        if (width > 0 && height > 0) {
          // Fill the zone
          ctx.fillStyle = style.color;
          ctx.fillRect(left, top, width, height);

          // Draw the border for the zone
          ctx.strokeStyle = style.borderColor;
          ctx.lineWidth = 1; // Adjust line width as needed
          ctx.strokeRect(left, top, width, height);

          // Draw the text labels
          ctx.fillStyle = style.textColor;
          ctx.font = 'bold 9px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const lines = [xR.label, yR.label];
          const lineH = 10;
          let yText = top + (height - lines.length * lineH) / 2 + lineH / 2;
          for (const line of lines) {
            ctx.fillText(line, left + width / 2, yText);
            yText += lineH;
          }
        }
      }
    }

    ctx.restore();
  },
};

export { ballDistributionZonePlugin };
