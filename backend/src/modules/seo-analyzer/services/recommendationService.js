// Dynamic recommendation generator (PROJECT_MASTER_PLAN.md §9).
// Produces one recommendation per `failed` or `warning` check with real measured values.

const PRIORITY_RANK = Object.freeze({
  high: 0,
  medium: 1,
  low: 2,
});

const getPriority = (check) => {
  if (check.status === 'failed' && (check.maxPoints ?? 0) >= 8) {
    return 'high';
  }
  if (check.status === 'failed') {
    return 'medium';
  }
  return 'low';
};

const buildCopyForCheck = (check) => {
  const { id, value } = check;

  switch (id) {
    case 'title.exists':
      return {
        title: 'Add a descriptive <title> tag',
        description:
          'Your page is missing a <title> tag (measured length: 0 characters). Add a unique 30–60 character <title> inside <head> summarizing the page topic.',
      };

    case 'title.length': {
      const length = typeof value === 'number' ? value : 0;
      if (length === 0) {
        return {
          title: 'Provide a <title> between 30 and 60 characters',
          description:
            'Your title is currently 0 characters because no <title> tag was found. Write a concise 30–60 character title.',
        };
      }
      if (length < 30) {
        const diff = 30 - length;
        return {
          title: `Expand your ${length}-character page title`,
          description: `Your title is ${length} characters. Search results perform best with 30–60 characters, so add at least ${diff} more character${diff === 1 ? '' : 's'} of descriptive context.`,
        };
      }
      const diff = length - 60;
      return {
        title: `Shorten your ${length}-character page title`,
        description: `Your title is ${length} characters. Search results usually show up to 60 characters, so shorten it by roughly ${diff} character${diff === 1 ? '' : 's'}.`,
      };
    }

    case 'meta.exists':
      return {
        title: 'Add a <meta name="description"> tag',
        description:
          'No <meta name="description"> tag was found (0 characters). Add a 70–160 character summary so search engines can display a clear snippet.',
      };

    case 'meta.length': {
      const length = typeof value === 'number' ? value : 0;
      if (length === 0) {
        return {
          title: 'Write a 70–160 character meta description',
          description:
            'Your meta description length is 0 characters. Add a compelling 70–160 character summary of the page.',
        };
      }
      if (length < 70) {
        const diff = 70 - length;
        return {
          title: `Expand your ${length}-character meta description`,
          description: `Your meta description is ${length} characters. Aim for 70–160 characters by adding at least ${diff} more character${diff === 1 ? '' : 's'}.`,
        };
      }
      const diff = length - 160;
      return {
        title: `Trim your ${length}-character meta description`,
        description: `Your meta description is ${length} characters. Search snippets typically truncate around 160 characters, so shorten it by at least ${diff} character${diff === 1 ? '' : 's'}.`,
      };
    }

    case 'headings.h1Exists':
      return {
        title: 'Add a primary H1 heading to the page',
        description:
          'Found 0 non-empty <h1> headings. Add one clear <h1> heading that defines the main subject of the page.',
      };

    case 'headings.h1Single': {
      const count = typeof value === 'number' ? value : 2;
      return {
        title: `Consolidate ${count} H1 headings into a single H1`,
        description: `The page contains ${count} <h1> tags. Keep 1 primary <h1> for the main page topic and demote the remaining ${count - 1} heading${count - 1 === 1 ? '' : 's'} to <h2> or <h3>.`,
      };
    }

    case 'headings.hierarchy': {
      const skips = Array.isArray(value) && value.length > 0 ? value.join(', ') : 'skipped levels';
      return {
        title: `Fix skipped heading levels (${skips})`,
        description: `Your document structure jumps directly across heading levels (${skips}). Nest headings sequentially (H1 -> H2 -> H3) for screen readers and semantic clarity.`,
      };
    }

    case 'images.altCoverage': {
      const total = value?.total ?? 0;
      const missingAlt = value?.missingAlt ?? 0;
      const coverage = value?.altCoverage ?? 0;
      return {
        title: `Add ALT text to ${missingAlt} image${missingAlt === 1 ? '' : 's'} (${coverage}% coverage)`,
        description: `Only ${coverage}% of your non-decorative images have ALT text (${missingAlt} of ${total} total images are missing an alt attribute). Add descriptive alt="..." attributes or alt="" for purely decorative graphics.`,
      };
    }

    case 'links.internalPresent':
      return {
        title: 'Add internal links to related pages',
        description:
          'Found 0 internal links on the page. Add at least 1 internal link to help visitors and crawlers discover related content on your site.',
      };

    case 'links.validHref': {
      const invalidCount = typeof value === 'number' ? value : 1;
      return {
        title: `Fix ${invalidCount} invalid link href attribute${invalidCount === 1 ? '' : 's'}`,
        description: `Found ${invalidCount} <a> element${invalidCount === 1 ? '' : 's'} with empty, "#"-only, or javascript: href attributes. Replace them with crawlable URLs or use <button> elements for interactive actions.`,
      };
    }

    case 'tech.https':
      return {
        title: 'Serve the page over HTTPS',
        description:
          'The page resolved over unencrypted HTTP (https: false). Redirect HTTP traffic to HTTPS to protect visitors and satisfy search engine security signals.',
      };

    case 'tech.statusRedirects': {
      const status = value?.status ?? 200;
      const redirects = value?.redirects ?? 0;
      if (status !== 200) {
        return {
          title: `Resolve non-200 HTTP response status (${status})`,
          description: `The audited URL returned HTTP ${status} after ${redirects} redirect${redirects === 1 ? '' : 's'}. Ensure indexable pages return HTTP 200 OK.`,
        };
      }
      return {
        title: `Shorten the ${redirects}-hop redirect chain`,
        description: `Reaching the final URL required ${redirects} redirects. Update links to point directly to the destination URL (2 or fewer redirects recommended).`,
      };
    }

    case 'tech.canonical': {
      if (value) {
        return {
          title: `Fix invalid canonical URL ("${value}")`,
          description: `The current canonical tag href="${value}" is not a valid absolute http/https URL. Use a full URL such as https://example.com/page.`,
        };
      }
      return {
        title: 'Add a self-referencing <link rel="canonical"> tag',
        description:
          'No canonical link tag was detected on the page. Add <link rel="canonical" href="..."> with the full preferred URL to prevent duplicate-content ambiguity.',
      };
    }

    case 'tech.viewport':
      return {
        title: 'Configure a mobile <meta name="viewport"> tag',
        description:
          'No viewport meta tag was found. Add <meta name="viewport" content="width=device-width, initial-scale=1.0"> so mobile devices render the page properly.',
      };

    case 'tech.lang':
      return {
        title: 'Declare a lang attribute on the <html> element',
        description:
          'The <html> element has no lang attribute. Set a valid BCP 47 language tag (for example, <html lang="en">) for assistive technologies and search engines.',
      };

    case 'tech.metaRobots': {
      const directive = value || 'noindex';
      return {
        title: `Remove "noindex" from meta robots ("${directive}")`,
        description: `The page includes meta robots="${directive}", which instructs search engines not to index it. Remove "noindex" if this page should appear in search results.`,
      };
    }

    case 'tech.robotsTxt': {
      const status = value?.status ?? 404;
      const url = value?.url ?? '/robots.txt';
      return {
        title: `Publish a valid robots.txt file (HTTP ${status})`,
        description: `Requesting ${url} returned HTTP ${status}. Host a robots.txt file returning HTTP 200 at the site root to guide crawler access and declare your sitemap.`,
      };
    }

    case 'tech.sitemap': {
      const status = value?.status ?? 404;
      const url = value?.url ?? '/sitemap.xml';
      if (status === 200) {
        return {
          title: 'Serve valid XML from your sitemap URL',
          description: `${url} returned HTTP 200, but its content did not contain a <urlset> or <sitemapindex> root element. Publish a valid XML sitemap.`,
        };
      }
      return {
        title: `Publish an XML sitemap at ${url} (HTTP ${status})`,
        description: `Fetching ${url} returned HTTP ${status}. Provide an XML sitemap returning HTTP 200 and reference it in robots.txt.`,
      };
    }

    default:
      return {
        title: `Address issue in ${check.label || id}`,
        description: check.message || `Measured value: ${JSON.stringify(value)}.`,
      };
  }
};

/**
 * Generates prioritized, data-driven recommendations for all `failed` and `warning` checks.
 * Excludes `passed` and `not_tested` checks.
 *
 * @param {Array<{
 *   id: string,
 *   label?: string,
 *   status: 'passed' | 'warning' | 'failed' | 'not_tested',
 *   maxPoints?: number,
 *   value: unknown,
 *   message?: string
 * }>} seoChecks
 */
export const generateRecommendations = (seoChecks = []) => {
  const actionable = seoChecks.filter(
    (check) => check && (check.status === 'failed' || check.status === 'warning'),
  );

  const recommendations = actionable.map((check) => {
    const priority = getPriority(check);
    const { title, description } = buildCopyForCheck(check);

    return {
      checkId: check.id,
      priority,
      title,
      description,
    };
  });

  recommendations.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);

  return recommendations;
};

export default generateRecommendations;
