import unittest
from app.pairing_engine import candidate, recommendations

def fragrance(i, name, tags, confidence="user-confirmed", favorite=False):
    return {"id":i,"name":name,"family_tags":tags,"character_tags":[],"profile_confidence":confidence,"is_favorite":favorite}

class PairingEngineTests(unittest.TestCase):
    def setUp(self):
        self.sweet=fragrance(1,"Sweet",["gourmand","amber"],favorite=True)
        self.wood=fragrance(2,"Wood",["woody","aromatic"])
        self.fresh=fragrance(3,"Fresh",["aquatic","fresh"])
        self.unknown=fragrance(4,"Unknown",[],"unknown")

    def test_no_candidate_without_a_rule(self):
        self.assertIsNone(candidate(self.sweet,self.unknown,"everyday"))

    def test_unknown_profile_does_not_create_confident_recommendation(self):
        rows=recommendations([self.sweet,self.unknown],"everyday")
        self.assertEqual(rows,[])

    def test_rejected_pair_is_excluded(self):
        rows=recommendations([self.sweet,self.wood],"date-night",feedback_by_pair={(1,2):"didnt_work"})
        self.assertEqual(rows,[])

    def test_loved_pair_scores_higher(self):
        plain=candidate(self.sweet,self.wood,"date-night")
        loved=candidate(self.sweet,self.wood,"date-night","loved")
        self.assertGreater(loved["score"],plain["score"])

    def test_is_deterministic_and_explains_rule(self):
        source=[self.sweet,self.wood,self.fresh]
        a=recommendations(source,"summer-day")
        b=recommendations(source,"summer-day")
        self.assertEqual(a,b)
        self.assertTrue(a[0]["rules"][0]["id"].startswith("R_"))
        self.assertIn("stored",a[0]["explanation"])

    def test_recent_pair_is_downranked(self):
        plain=recommendations([self.sweet,self.wood],"date-night")[0]
        recent=recommendations([self.sweet,self.wood],"date-night",recent_pairs={(1,2)})[0]
        self.assertTrue(recent["recently_worn"])
        self.assertEqual(recent["score"],plain["score"]-15)

    def test_near_identical_profiles_are_not_presented_as_a_pair(self):
        twin=fragrance(5,"Fresh twin",["aquatic","fresh"])
        self.assertIsNone(candidate(self.fresh,twin,"summer-day"))

if __name__ == "__main__": unittest.main()
