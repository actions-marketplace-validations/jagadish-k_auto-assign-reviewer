const core = require('@actions/core');
const { getOctokit, context } = require('@actions/github');

const reviewers = (core.getInput('reviewers') || '').split(',');
const team_reviewers = (core.getInput('team_reviewers') || '').split(',');
const githubToken = core.getInput('github-token') || '';

const run = async () => {
  try {
    const github = getOctokit(githubToken);

    const { owner, repo } = context.repo;
    const pull_number = context.payload.pull_request.number;
    const { data } = await github.rest.pulls.listRequestedReviewers({
      owner,
      repo,
      pull_number,
    });
    const { users = [], teams = [] } = data;

    if (users.length === 0 && teams.length === 0) {
      console.log('No Reviewers have been assigned to this PR.');
      console.log('Lets try to assign some');
      if (!reviewers.length) {
        if (!team_reviewers.length) {
          throw new Error('`reviewers` and `reviewers_team` are both missing');
        }
        reviewers = new Set();

        for (const team_slug of team_reviewers) {
          const teamData = await github.rest.teams.listMembersInOrg({
            org: owner,
            team_slug,
          });
          teamData.data.forEach((item) => reviewers.add(item.login));
        }
        reviewers = Array.from(reviewers);
        console.log('No reviewers were found. Hence assigning a reviewer');
      }
      await github.rest.pulls.requestReviewers({
        owner,
        repo,
        pull_number,
        reviewers,
        team_reviewers,
      });
    } else {
      console.log('Reviewers have already been assigned to this PR.');
      console.log('Lets try to rerequest review');
      await github.rest.pulls.requestReviewers({
        owner,
        repo,
        pull_number,
        reviewers: users.map((user) => user.login),
        team_reviewers: teams.map((team) => team.name),
      });
    }
  } catch (e) {
    console.error(e);
    core.setFailed(e.message);
  }
};

run();
