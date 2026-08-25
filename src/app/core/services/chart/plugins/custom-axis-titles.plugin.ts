const customAxisTitlesPlugin = {
  id: 'customAxisTitles',
  afterDraw(chart: { chartArea: any; ctx: any; }) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return;

    // --- X-Axis Title Logic ---
    ctx.save();
    ctx.fillStyle = 'grey';
    ctx.font = 'bold 12px Arial';
    const xAxisYPos = chartArea.bottom + 35;

    ctx.textAlign = 'left';
    ctx.fillText('← Less Flare', chartArea.left - 20, xAxisYPos);

    ctx.textAlign = 'center';
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = 'white';
    ctx.fillText('Diff', (chartArea.left + chartArea.right) / 2, xAxisYPos);

    ctx.textAlign = 'right';
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = 'grey';
    ctx.fillText('More Flare →', chartArea.right + 10, xAxisYPos);
    ctx.restore();

    // --- Y-Axis Title Logic ---
    ctx.save();
    const yAxisXPos = chartArea.left - 40;
    const earlierRollYPos = chartArea.bottom - 25;
    const diffYPos = (chartArea.top + chartArea.bottom) / 2;
    const laterRollPos = chartArea.top + 35;

    function drawRotated(text: string, x: number, y: number, font: string, color: string) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }

    drawRotated('← Earlier Roll', yAxisXPos, earlierRollYPos, 'bold 12px Arial', 'grey');
    drawRotated('RG', yAxisXPos, diffYPos, 'bold 14px Arial', 'white');
    drawRotated('Later Roll →', yAxisXPos, laterRollPos, 'bold 12px Arial', 'grey');

    ctx.restore();
  },
};

export { customAxisTitlesPlugin };