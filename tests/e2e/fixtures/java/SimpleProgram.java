/**
 * Simple Java program for E2E testing
 * Basic program with simple methods for debugging
 */
public class SimpleProgram {
    public static void main(String[] args) throws Exception {
        // Keep running for a while to allow debugging
        System.out.println("SimpleProgram started");

        int x = 10;
        int y = 20;
        int sum = add(x, y);
        System.out.println("Sum: " + sum);

        // Add longer delay to keep program running
        Thread.sleep(30000);

        // Call another method
        int product = multiply(x, y);
        System.out.println("Product: " + product);

        Thread.sleep(30000);

        System.out.println("SimpleProgram finished");
    }

    public static int add(int a, int b) {
        return a + b;
    }

    public static int multiply(int a, int b) {
        return a * b;
    }
}
