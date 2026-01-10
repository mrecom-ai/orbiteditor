
def calculate_factorial(n):
    """Calculate the factorial of a given number."""
    if n < 0:
        raise ValueError("Factorial is not defined for negative numbers")
    if n == 0 or n == 1:
        return 1
    
    result = 1
    for i in range(2, n + 1):
        result *= i
    return result


def find_max_in_list(numbers):
    """Find the maximum number in a list."""
    if not numbers:
        raise ValueError("Cannot find maximum of empty list")
    
    max_num = numbers[0]
    for num in numbers:
        if num > max_num:
            max_num = num
    return max_num


def is_prime(n):
    """Check if a number is prime."""
    if n < 2:
        return False
    if n == 2:
        return True
    if n % 2 == 0:
        return False
    
    for i in range(3, int(n**0.5) + 1, 2):
        if n % i == 0:
            return False
    return True


def reverse_string(text):
    """Reverse a given string."""
    if not isinstance(text, str):
        raise TypeError("Input must be a string")
    
    return text[::-1]


def fibonacci_sequence(n):
    """Generate the first n numbers in the Fibonacci sequence."""
    if n < 0:
        raise ValueError("Number of terms cannot be negative")
    if n == 0:
        return []
    if n == 1:
        return [0]
    if n == 2:
        return [0, 1]
    
    sequence = [0, 1]
    for i in range(2, n):
        sequence.append(sequence[i-1] + sequence[i-2])
    return sequence