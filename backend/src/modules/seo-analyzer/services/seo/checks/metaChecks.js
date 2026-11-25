// Meta description checks: meta.exists and meta.length (PROJECT_MASTER_PLAN.md §7).

const MIN_PASS_LENGTH = 70;
const MAX_PASS_LENGTH = 160;
const MIN_WARN_LENGTH = 50;
const MAX_WARN_LENGTH = 200;

export const runMetaChecks = ({ metaDescription, descriptionLength }) => {
  const hasDescription = Boolean(metaDescription && descriptionLength > 0);

  const existsCheck = {
    id: 'meta.exists',
    category: 'meta',
    label: 'Meta description exists',
    status: hasDescription ? 'passed' : 'failed',
    value: hasDescription ? metaDescription : null,
    message: hasDescription
      ? 'The page has a non-empty <meta name="description"> tag.'
      : 'The page is missing a <meta name="description"> tag or its content is empty.',
    reason: null,
  };

  let lengthStatus = 'failed';
  let lengthMessage = 'Meta description length could not be evaluated because the tag is missing.';

  if (hasDescription) {
    if (descriptionLength >= MIN_PASS_LENGTH && descriptionLength <= MAX_PASS_LENGTH) {
      lengthStatus = 'passed';
      lengthMessage = `Meta description length is ${descriptionLength} characters (ideal range: ${MIN_PASS_LENGTH}–${MAX_PASS_LENGTH}).`;
    } else if (
      (descriptionLength >= MIN_WARN_LENGTH && descriptionLength < MIN_PASS_LENGTH) ||
      (descriptionLength > MAX_PASS_LENGTH && descriptionLength <= MAX_WARN_LENGTH)
    ) {
      lengthStatus = 'warning';
      lengthMessage = `Meta description length is ${descriptionLength} characters (recommended: ${MIN_PASS_LENGTH}–${MAX_PASS_LENGTH}).`;
    } else {
      lengthStatus = 'failed';
      lengthMessage = `Meta description length is ${descriptionLength} characters, outside the acceptable ${MIN_WARN_LENGTH}–${MAX_WARN_LENGTH} range.`;
    }
  }

  const lengthCheck = {
    id: 'meta.length',
    category: 'meta',
    label: 'Meta description length',
    status: lengthStatus,
    value: descriptionLength,
    message: lengthMessage,
    reason: null,
  };

  return [existsCheck, lengthCheck];
};

export default runMetaChecks;
