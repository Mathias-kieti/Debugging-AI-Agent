def calculate_average(numbers):
    total = sum(numbers)
    count = len(numbers)
    return total / count

def find_max(numbers):
    if not numbers:
        return None
    current_max = numbers[0]
    for num in numbers:
        if num > current_max:
            current_max = num
    return current_max
