/**
 * Simple Java program for E2E testing
 * Basic program with simple methods for debugging
 */
public class SimpleProgram {
    public static void main(String[] args) throws Exception {
        int x = 10;
        int y = 20;
        int sum = add(x, y);
        System.out.println("Sum: " + sum);

        // Add some delay to keep program running
        Thread.sleep(1000);

        // Call another method
        int product = multiply(x, y);
        System.out.println("Product: " + product);

        Thread.sleep(1000);
    }

    public static int add(int a, int b) {
        return a + b;
    }

    public static int multiply(int a, int b) {
        return a * b;
    }
}
