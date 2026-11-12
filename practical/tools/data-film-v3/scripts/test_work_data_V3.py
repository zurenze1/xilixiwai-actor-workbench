import unittest,copy,tempfile
from pathlib import Path
from work_data_V3 import blank,normalize,calculations
from server_V3 import Store
class DataCases(unittest.TestCase):
 def setUp(self):
  self.d=blank('income');self.d.update(source='功能验收演示，非真实收入',beforeDays=22,afterDays=26,beforeDailyHours=8,afterDailyHours=10,beforeIncome=8000,afterIncome=8000)
 def test_salary_components(self):
  d=blank('salary');d.update(source='演示',salaryRows=[dict(label='固定',before=6000,after=6000),dict(label='奖金',before=1000,after=400),dict(label='补贴',before=300,after=300)]);c=calculations(normalize(d));self.assertEqual((c['before'],c['after'],c['delta']),(7300,6700,-600))
 def test_hours(self):
  d={**self.d,'template':'hours'};c=calculations(normalize(d));self.assertEqual((c['beforeHours'],c['afterHours'],c['hoursDelta']),(176,260,84))
 def test_hourly(self):
  c=calculations(normalize(self.d));self.assertAlmostEqual(c['beforeHourly'],8000/176);self.assertAlmostEqual(c['afterHourly'],8000/260)
 def test_missing_not_zero(self):
  for x in ['',None,-1,float('nan'),float('inf')]:
   with self.assertRaises(ValueError):normalize({**self.d,'beforeIncome':x})
  self.assertEqual(normalize({**self.d,'beforeIncome':0})['beforeIncome'],0)
 def test_division_by_zero(self):
  with self.assertRaises(ValueError):normalize({**self.d,'beforeDays':0})
 def test_source_and_boundaries(self):
  for patch in [dict(source=''),dict(beforeDays=32),dict(afterDailyHours=25),dict(accent='red;'),dict(duration=7)]:
   with self.assertRaises(ValueError):normalize({**self.d,**patch})
 def test_zero_baseline(self):
  d=blank('salary');d.update(source='演示',salaryRows=[dict(label='奖金',before=0,after=1)]);self.assertIsNone(calculations(normalize(d))['percent'])
 def test_saved_draft_survives_reload(self):
  parent=Path(__file__).resolve().parents[1]/'evidence/V3-tests';parent.mkdir(parents=True,exist_ok=True)
  with tempfile.TemporaryDirectory(dir=parent) as t:
   s=Store(Path(t)/'state',Path(t)/'outputs');s.save_draft(self.d);self.assertEqual(Store(Path(t)/'state',Path(t)/'outputs').drafts()['income']['beforeIncome'],8000)
if __name__=='__main__':unittest.main()
