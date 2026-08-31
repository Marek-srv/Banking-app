import { prisma } from "../../config/prisma";
import { Prisma } from "../../generated/prisma/client";
import {
  PaginationInput,
  paginationMetadata,
} from "../../schemas/pagination.schema";

export class EmployeeServiceError extends Error {
  constructor(public readonly code: "EMPLOYEE_NOT_FOUND") {
    super(code);
  }
}

const employeeSelect = {
  employee_id: true,
  employee_number: true,
  first_name: true,
  last_name: true,
  position: true,
  hire_date: true,
  status: true,
  branches_employees_branch_idTobranches: {
    select: {
      branch_id: true,
      branch_code: true,
      branch_name: true,
      city: true,
      state: true,
    },
  },
} satisfies Prisma.employeesSelect;

type EmployeeRecord = Prisma.employeesGetPayload<{
  select: typeof employeeSelect;
}>;

function toEmployeeResponse(employee: EmployeeRecord) {
  const branch = employee.branches_employees_branch_idTobranches;

  return {
    employeeId: employee.employee_id.toString(),
    employeeNumber: employee.employee_number,
    firstName: employee.first_name,
    lastName: employee.last_name,
    position: employee.position,
    hireDate: employee.hire_date,
    status: employee.status,
    branch: {
      branchId: branch.branch_id.toString(),
      branchCode: branch.branch_code,
      branchName: branch.branch_name,
      city: branch.city,
      state: branch.state,
    },
  };
}

export async function listEmployees(input: PaginationInput) {
  const skip = (input.page - 1) * input.limit;
  const [total, employees] = await prisma.$transaction([
    prisma.employees.count(),
    prisma.employees.findMany({
      select: employeeSelect,
      orderBy: { employee_id: "asc" },
      skip,
      take: input.limit,
    }),
  ]);

  return {
    items: employees.map(toEmployeeResponse),
    pagination: paginationMetadata(input, total),
  };
}

export async function getEmployee(employeeId: bigint) {
  const employee = await prisma.employees.findUnique({
    where: { employee_id: employeeId },
    select: employeeSelect,
  });

  if (!employee) {
    throw new EmployeeServiceError("EMPLOYEE_NOT_FOUND");
  }

  return toEmployeeResponse(employee);
}
