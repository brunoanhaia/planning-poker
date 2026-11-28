import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';

/**
 * The human rendering of `docs/`: an agent reads those files from the tree, and a
 * person reads the same pages here. Nothing is authored on the site and nothing is
 * published by hand — this config only turns the markdown into pages.
 *
 * `base` matches the repository name because GitHub Pages serves a project site
 * under `/planning-poker/`.
 */
export default withMermaid(
    defineConfig({
        base: '/planning-poker/',
        cleanUrls: true,
        description:
            'Real-time planning poker: features, roles, protocol, security, deployment — verified against the code.',
        lang: 'en-US',
        // One index file serves both audiences: GitHub renders docs/README.md when
        // the folder opens, and the rewrite serves it as the site home.
        rewrites: { 'README.md': 'index.md' },
        title: 'PlanItPoker',
        themeConfig: {
            nav: [
                { link: '/hosting-a-session', text: 'Using a session' },
                { link: '/architecture-overview', text: 'How it works' },
                { link: '/deploy-with-docker', text: 'Running it' },
                { link: '/onboarding', text: 'Building it' },
                { link: '/security-review', text: 'Deep dives' },
            ],
            outline: 'deep',
            sidebar: [
                {
                    items: [
                        { link: '/hosting-a-session', text: 'Hosting a session' },
                        { link: '/joining-a-session', text: 'Joining a session' },
                        { link: '/roles-and-permissions', text: 'Roles and permissions' },
                        { link: '/voting-and-results', text: 'Voting and results' },
                        {
                            link: '/session-summary-and-export',
                            text: 'Session summary and export',
                        },
                        { link: '/troubleshooting', text: 'Troubleshooting' },
                    ],
                    text: 'Using a session',
                },
                {
                    items: [
                        { link: '/architecture-overview', text: 'Architecture overview' },
                        { link: '/real-time-protocol', text: 'Real-time protocol' },
                        { link: '/security-model', text: 'Security model' },
                        { link: '/limits-and-ceilings', text: 'Limits and ceilings' },
                    ],
                    text: 'How it works',
                },
                {
                    items: [
                        { link: '/deploy-with-docker', text: 'Deploy with Docker' },
                        { link: '/hosted-test-deployment', text: 'Hosted test deployment' },
                        { link: '/operations-runbook', text: 'Operations runbook' },
                    ],
                    text: 'Running it',
                },
                {
                    items: [
                        { link: '/onboarding', text: 'Onboarding' },
                        { link: '/testing-strategy', text: 'Testing strategy' },
                        { link: '/adding-a-language', text: 'Adding a language' },
                        { link: '/decisions', text: 'Decisions' },
                        { link: '/requirements-trace', text: 'Requirements trace' },
                    ],
                    text: 'Building it',
                },
                {
                    items: [
                        { link: '/security-review', text: 'Security review' },
                        { link: '/regression-playbook', text: 'Regression playbook' },
                        { link: '/test-plan', text: 'Test plan' },
                    ],
                    text: 'Deep dives',
                },
            ],
        },
    })
);
