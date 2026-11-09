def calculate_average(numbers):
    """
    Calculate the arithmetic mean of a list of numbers.
    Bug: Does not handle empty list gracefully, causing ZeroDivisionError.
    """
    total = sum(numbers)
    count = len(numbers)
    return total / count if count != 0 else 0

def find_max(numbers):
    if not numbers:
        return None
    current_max = numbers[0]
    for num in numbers:
        if num > current_max:
            current_max = num
    return current_max
