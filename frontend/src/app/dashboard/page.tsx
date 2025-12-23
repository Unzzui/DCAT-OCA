'use client'

import { Header } from '@/components/layout/Header'
import { Card, Metric, Text, Flex, ProgressBar, Grid, Title, BarChart, DonutChart } from '@tremor/react'
import { ClipboardCheck, FileText, Scissors, SearchX, TrendingUp, TrendingDown } from 'lucide-react'

const services = [
  {
    name: 'Informe NNCC',
    value: 42000,
    change: 8.5,
    icon: ClipboardCheck,
    color: 'emerald',
    href: '/dashboard/nuevas-conexiones',
    active: true,
  },
  {
    name: 'Lecturas',
    value: 0,
    change: 0,
    icon: FileText,
    color: 'gray',
    href: '/dashboard/lecturas',
    active: false,
  },
  {
    name: 'Corte y Reposicion',
    value: 0,
    change: 0,
    icon: Scissors,
    color: 'gray',
    href: '/dashboard/corte-reposicion',
    active: false,
  },
  {
    name: 'Control Perdidas',
    value: 0,
    change: 0,
    icon: SearchX,
    color: 'gray',
    href: '/dashboard/control-perdidas',
    active: false,
  },
]

const chartData = [
  { mes: 'Jul', cantidad: 4890 },
  { mes: 'Ago', cantidad: 5230 },
  { mes: 'Sep', cantidad: 4800 },
  { mes: 'Oct', cantidad: 5100 },
  { mes: 'Nov', cantidad: 5450 },
  { mes: 'Dic', cantidad: 5680 },
]

const zonaData = [
  { name: 'Florida', value: 35 },
  { name: 'Chacabuco', value: 28 },
  { name: 'Cordillera', value: 22 },
  { name: 'Pacifico', value: 15 },
]

export default function DashboardPage() {
  return (
    <div className="min-h-screen">
      <Header
        title="Dashboard"
        subtitle="Vista general de todos los servicios"
      />

      <div className="p-6">
        {/* Service Cards */}
        <Grid numItemsSm={2} numItemsLg={4} className="gap-6">
          {services.map((service) => (
            <Card
              key={service.name}
              className={`cursor-pointer transition-shadow hover:shadow-lg ${
                !service.active ? 'opacity-60' : ''
              }`}
              decoration="top"
              decorationColor={service.active ? 'blue' : 'gray'}
            >
              <Flex alignItems="start">
                <div>
                  <Text>{service.name}</Text>
                  <Metric>{service.active ? service.value.toLocaleString('es-CL') : '-'}</Metric>
                </div>
                <div
                  className={`rounded-lg p-2 ${
                    service.active ? 'bg-oca-blue-lighter text-oca-blue' : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  <service.icon size={24} />
                </div>
              </Flex>
              {service.active && (
                <Flex className="mt-4" justifyContent="start" alignItems="center">
                  {service.change > 0 ? (
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                  <Text className={service.change > 0 ? 'text-emerald-500' : 'text-red-500'}>
                    {service.change > 0 ? '+' : ''}{service.change}%
                  </Text>
                  <Text className="ml-2">vs mes anterior</Text>
                </Flex>
              )}
              {!service.active && (
                <Text className="mt-4 text-gray-400">Proximamente</Text>
              )}
            </Card>
          ))}
        </Grid>

        {/* Charts Section */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Bar Chart */}
          <Card className="lg:col-span-2">
            <Title>Inspecciones NNCC por Mes</Title>
            <Text>Ultimos 6 meses</Text>
            <BarChart
              className="mt-4 h-72"
              data={chartData}
              index="mes"
              categories={['cantidad']}
              colors={['blue']}
              valueFormatter={(value) => value.toLocaleString('es-CL')}
              yAxisWidth={48}
            />
          </Card>

          {/* Donut Chart */}
          <Card>
            <Title>Distribucion por Zona</Title>
            <Text>Inspecciones NNCC</Text>
            <DonutChart
              className="mt-4 h-52"
              data={zonaData}
              category="value"
              index="name"
              colors={['blue', 'cyan', 'indigo', 'slate']}
              valueFormatter={(value) => `${value}%`}
            />
            <div className="mt-4 space-y-2">
              {zonaData.map((zona) => (
                <Flex key={zona.name} justifyContent="between" alignItems="center">
                  <Text>{zona.name}</Text>
                  <Text className="font-medium">{zona.value}%</Text>
                </Flex>
              ))}
            </div>
          </Card>
        </div>

        {/* Progress Section */}
        <Card className="mt-6">
          <Title>Estado de Servicios</Title>
          <Text>Progreso de integracion de datos</Text>
          <div className="mt-4 space-y-4">
            <div>
              <Flex>
                <Text>Informe NNCC</Text>
                <Text>100%</Text>
              </Flex>
              <ProgressBar value={100} color="emerald" className="mt-2" />
            </div>
            <div>
              <Flex>
                <Text>Lecturas</Text>
                <Text>0%</Text>
              </Flex>
              <ProgressBar value={0} color="gray" className="mt-2" />
            </div>
            <div>
              <Flex>
                <Text>Corte y Reposicion</Text>
                <Text>0%</Text>
              </Flex>
              <ProgressBar value={0} color="gray" className="mt-2" />
            </div>
            <div>
              <Flex>
                <Text>Control de Perdidas</Text>
                <Text>0%</Text>
              </Flex>
              <ProgressBar value={0} color="gray" className="mt-2" />
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
