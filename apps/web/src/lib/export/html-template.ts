interface ExportStep {
  order: number;
  title: string;
  description: string;
  screenshotUrl?: string | null;
  tipType?: 'tip' | 'caution' | 'note' | 'best-practice' | 'update' | null;
}

interface ExportGuide {
  title: string;
  description?: string | null;
  steps: ExportStep[];
  brandKit?: {
    colorPrimary?: string;
    colorSecondary?: string;
    colorAccent?: string;
    fontFamily?: string;
    logoUrl?: string | null;
  } | null;
}

interface ExportOptions {
  includeWrapper?: boolean;
  standalone?: boolean;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function descriptionToHtml(description: string): string {
  if (!description) return '';
  let html = escapeHtml(description);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\n\n/g, '<br><br>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

function generateStyles(brandKit?: ExportGuide['brandKit']): string {
  const primary = brandKit?.colorPrimary || '#007BFF';
  const fontFamily = brandKit?.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  return `
<!-- START: ShowcaseIt CSS Styling -->
<style>
/* ShowcaseIt Guide Container */
.showcaseit-guide {
    box-sizing: border-box;
    width: 100%;
    height: min-content;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 0px 120px;
    overflow: hidden;
    align-content: center;
    flex-wrap: nowrap;
    gap: 0px;
    font-family: ${fontFamily};
    color: #333;
    max-width: 960px;
    margin: 0 auto;
}

.showcaseit-guide * {
    box-sizing: border-box;
}

.showcaseit-guide h1 {
    font-size: 28px;
    font-weight: 700;
    margin: 24px 0 8px;
    width: 100%;
}

.showcaseit-guide .guide-description {
    font-size: 16px;
    color: #666;
    margin-bottom: 24px;
    width: 100%;
}

/* STEP box */
.showcaseit-step {
    background-color: #F5F9FC;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 16px;
    font-size: 16px;
    width: 100%;
    box-sizing: border-box;
    display: flex;
    align-items: flex-start;
    gap: 8px;
}

.showcaseit-step .step-number {
    background: white;
    color: ${primary};
    border-radius: 50%;
    width: 32px;
    height: 32px;
    min-width: 32px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-weight: bold;
    font-size: 16px;
    border: 2px solid ${primary};
}

.showcaseit-step .description {
    flex: 1;
    line-height: 1.5;
    font-size: 16px;
}

.showcaseit-step .description ul {
    margin: 8px 0;
    padding-left: 20px;
}

.showcaseit-step .description li {
    margin-bottom: 4px;
}

/* TIP box (base) */
.showcaseit-step-tip {
    background-color: #E8F7F0;
    border: 1px solid #A4D6C2;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 16px;
    font-size: 16px;
    width: 100%;
    box-sizing: border-box;
    display: flex;
    align-items: flex-start;
    gap: 8px;
}

.showcaseit-step-tip .icon::before {
    content: '💡';
    font-size: 20px;
    line-height: 1;
    display: inline-block;
}

.showcaseit-step-tip.caution .icon::before { content: '⚠️'; }
.showcaseit-step-tip.note .icon::before { content: '📝'; }
.showcaseit-step-tip.best-practice .icon::before { content: '✅'; }
.showcaseit-step-tip.update .icon::before { content: '🔄'; }

.showcaseit-step-tip .icon {
    width: 24px;
    height: 24px;
    flex: none;
    align-self: flex-start;
}

.showcaseit-step-tip .description {
    flex: 1;
    line-height: 1.5;
    font-size: 16px;
}

.showcaseit-step-tip .description ul {
    margin: 8px 0;
    padding-left: 20px;
}

.showcaseit-step-tip .description li {
    margin-bottom: 4px;
}

.showcaseit-step-tip.caution {
    background-color: #FFF8E5;
    border: 1px solid #F5C16C;
}

.showcaseit-step-tip.note {
    background-color: #F0F4FF;
    border: 1px solid #A4B8D6;
}

.showcaseit-step-tip.best-practice {
    background-color: #E8F7F0;
    border: 1px solid #A4D6C2;
}

.showcaseit-step-tip.update {
    background-color: #F0F0FF;
    border: 1px solid #B0B0D6;
}

/* Screenshot container */
.showcaseit-screenshot-container {
    background-color: #F5F9FC;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 16px;
    width: 100%;
    box-sizing: border-box;
    text-align: center;
}

.showcaseit-screenshot-container img.showcaseit-screenshot {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
}

@media (max-width: 768px) {
    .showcaseit-guide {
        padding: 0 24px;
    }
}
</style>
<!-- END: ShowcaseIt CSS Styling -->`;
}

export function generateHtmlExport(guide: ExportGuide, options: ExportOptions = {}): string {
  const { includeWrapper = true, standalone = true } = options;

  const styles = generateStyles(guide.brandKit);

  let stepNumber = 0;
  const stepsHtml = guide.steps
    .map((step) => {
      const isTip = step.tipType != null;
      let html = '';

      if (isTip) {
        const tipClass = step.tipType === 'tip' ? '' : ` ${step.tipType}`;
        html += `\n<!-- TIP -->\n`;
        html += `<div class="showcaseit-step-tip${tipClass}">\n`;
        html += `    <div class="icon"></div>\n`;
        html += `    <div class="description">\n`;
        html += `        ${descriptionToHtml(step.description)}\n`;
        html += `    </div>\n`;
        html += `</div>\n`;
      } else {
        stepNumber++;
        html += `\n<!-- STEP ${stepNumber} -->\n`;
        html += `<div class="showcaseit-step">\n`;
        html += `    <div class="step-number">${stepNumber}</div>\n`;
        html += `    <div class="description">\n`;
        if (step.title && step.title !== `Step ${step.order}`) {
          html += `        <strong>${escapeHtml(step.title)}</strong><br><br>\n`;
        }
        html += `        ${descriptionToHtml(step.description)}\n`;
        html += `    </div>\n`;
        html += `</div>\n`;

        if (step.screenshotUrl) {
          html += `\n<div class="showcaseit-screenshot-container">\n`;
          html += `    <img class="showcaseit-screenshot" width="560" alt="Step ${stepNumber}" src="${escapeHtml(step.screenshotUrl)}">\n`;
          html += `</div>\n`;
        }
      }

      return html;
    })
    .join('');

  const bodyContent = `
<div class="showcaseit-guide">
    <h1>${escapeHtml(guide.title)}</h1>
    ${guide.description ? `<p class="guide-description">${escapeHtml(guide.description)}</p>` : ''}
${stepsHtml}
</div>`;

  if (standalone) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(guide.title)}</title>
    ${styles}
</head>
<body style="margin: 0; padding: 24px 0; background: #fff;">
${bodyContent}
</body>
</html>`;
  }

  if (includeWrapper) {
    return `${styles}\n${bodyContent}`;
  }

  return bodyContent;
}
