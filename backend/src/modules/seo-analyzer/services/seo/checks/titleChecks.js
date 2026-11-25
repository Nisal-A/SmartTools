// Title checks: title.exists and title.length (PROJECT_MASTER_PLAN.md §7).
// Point weights live exclusively in scoringConfig.js (Sprint 4).

const MIN_PASS_LENGTH = 30;
const MAX_PASS_LENGTH = 60;
const MIN_WARN_LENGTH = 10;
const MAX_WARN_LENGTH = 70;

export const runTitleChecks = ({ pageTitle, titleLength }) => {
  const hasTitle = Boolean(pageTitle && titleLength > 0);

  const existsCheck = {
    id: 'title.exists',
    category: 'title',
    label: 'Page title exists',
    status: hasTitle ? 'passed' : 'failed',
    value: hasTitle ? pageTitle : null,
    message: hasTitle
      ? 'The page has a non-empty <title> tag.'
      : 'The page is missing a <title> tag or its content is empty.',
    reason: null,
  };

  let lengthStatus = 'failed';
  let lengthMessage = 'Title length could not be evaluated because the <title> tag is missing.';

  if (hasTitle) {
    if (titleLength >= MIN_PASS_LENGTH && titleLength <= MAX_PASS_LENGTH) {
      lengthStatus = 'passed';
      lengthMessage = `Title length is ${titleLength} characters (ideal range: ${MIN_PASS_LENGTH}–${MAX_PASS_LENGTH}).`;
    } else if (
      (titleLength >= MIN_WARN_LENGTH && titleLength < MIN_PASS_LENGTH) ||
      (titleLength > MAX_PASS_LENGTH && titleLength <= MAX_WARN_LENGTH)
    ) {
      lengthStatus = 'warning';
      lengthMessage = `Title length is ${titleLength} characters (recommended: ${MIN_PASS_LENGTH}–${MAX_PASS_LENGTH}).`;
    } else {
      lengthStatus = 'failed';
      lengthMessage = `Title length is ${titleLength} characters, outside the acceptable ${MIN_WARN_LENGTH}–${MAX_WARN_LENGTH} range.`;
    }
  }

  const lengthCheck = {
    id: 'title.length',
    category: 'title',
    label: 'Page title length',
    status: lengthStatus,
    value: titleLength,
    message: lengthMessage,
    reason: null,
  };

  return [existsCheck, lengthCheck];
};

export default runTitleChecks;
