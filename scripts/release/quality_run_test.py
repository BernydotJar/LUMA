import unittest

from quality_run import REQUIRED_QUALITY, verify_quality_for_review

COMMIT = 'a' * 40
RUN = {'head_sha': COMMIT, 'event': 'pull_request', 'conclusion': 'failure'}
CORE = [{'name': name, 'conclusion': 'success'} for name in REQUIRED_QUALITY]


class QualityReviewBootstrapTests(unittest.TestCase):
    def test_five_green_jobs_and_only_missing_attestation_can_initiate_review(self):
        proof = verify_quality_for_review(RUN, CORE + [
            {'name': 'release-readiness', 'conclusion': 'failure'},
            {'name': 'deploy', 'conclusion': 'skipped'},
        ], COMMIT)
        self.assertEqual(proof['quality'], 'PASS')
        self.assertEqual(proof['releaseReadiness'], 'BLOCKED_AWAITING_REVIEW')
        self.assertEqual(proof['overall'], 'failure')

    def test_all_green_pr_also_valid(self):
        run = {**RUN, 'conclusion': 'success'}
        result = verify_quality_for_review(run, CORE + [{'name': 'release-readiness', 'conclusion': 'success'}], COMMIT)
        self.assertEqual(result['quality'], 'PASS')

    def test_no_failed_required_check_can_bootstrap(self):
        for name in REQUIRED_QUALITY:
            bad = [({**job, 'conclusion': 'failure'} if job['name'] == name else job) for job in CORE]
            with self.subTest(name=name), self.assertRaises(ValueError):
                verify_quality_for_review(RUN, bad + [{'name': 'release-readiness', 'conclusion': 'failure'}], COMMIT)

    def test_no_unrelated_failure_may_bootstrap(self):
        for extra in [{'name': 'security-audit-extra', 'conclusion': 'failure'},
                      {'name': 'deploy', 'conclusion': 'failure'},
                      {'name': 'deploy', 'conclusion': 'cancelled'}]:
            with self.subTest(extra=extra), self.assertRaises(ValueError):
                verify_quality_for_review(RUN, CORE + [extra, {'name': 'release-readiness', 'conclusion': 'failure'}], COMMIT)

    def test_strict_commit_and_event_and_completion(self):
        jobs = CORE + [{'name': 'release-readiness', 'conclusion': 'failure'}]
        for wrong in [{**RUN, 'head_sha': 'b' * 40}, {**RUN, 'event': 'push'}, {**RUN, 'conclusion': None}]:
            with self.subTest(wrong=wrong), self.assertRaises(ValueError):
                verify_quality_for_review(wrong, jobs, COMMIT)

    def test_required_checks_cannot_be_duplicated_or_missing(self):
        for missing in REQUIRED_QUALITY:
            with self.subTest(name=missing), self.assertRaises(ValueError):
                verify_quality_for_review(RUN, [x for x in CORE if x['name'] != missing] +
                    [{'name': 'release-readiness', 'conclusion': 'failure'}], COMMIT)
        with self.assertRaises(ValueError):
            verify_quality_for_review(RUN, CORE + [CORE[0], {'name': 'release-readiness', 'conclusion': 'failure'}], COMMIT)

    def test_approval_gate_must_be_the_only_failing_gate(self):
        jobs = CORE + [{'name': 'release-readiness', 'conclusion': 'failure'}]
        with self.assertRaises(ValueError):
            verify_quality_for_review({**RUN, 'conclusion': 'success'}, jobs, COMMIT)
        with self.assertRaises(ValueError):
            verify_quality_for_review(RUN, CORE, COMMIT)


if __name__ == '__main__':
    unittest.main()
