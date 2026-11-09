import unittest
from calculator import calculate_average, find_max

class TestCalculator(unittest.TestCase):
    def test_average_normal(self):
        self.assertEqual(calculate_average([10, 20, 30]), 20)

    def test_average_single(self):
        self.assertEqual(calculate_average([5]), 5)

    def test_average_empty_list(self):
        # This will trigger ZeroDivisionError on unpatched code
        self.assertEqual(calculate_average([]), 0)

    def test_max_normal(self):
        self.assertEqual(find_max([1, 9, 3]), 9)

if __name__ == '__main__':
    unittest.main()
